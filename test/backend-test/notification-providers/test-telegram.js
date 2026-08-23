const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const express = require("express");
const bodyParser = require("body-parser");

const Telegram = require("../../../server/notification-providers/telegram");
const { UP, DOWN } = require("../../../src/util");

const BOT_TOKEN = "123456:test-token";

/**
 * Minimal stand-in for the Telegram bot API, recording every call it receives
 */
class MockTelegramServer {
    calls = [];
    nextMessageID = 1;
    deleteShouldFail = false;

    /**
     * Start listening on a random free port
     * @returns {Promise<void>}
     */
    start() {
        const app = express();
        app.use(bodyParser.json());

        app.post(`/bot${BOT_TOKEN}/sendMessage`, (req, res) => {
            this.calls.push({ method: "sendMessage", body: req.body });
            res.json({ ok: true, result: { message_id: this.nextMessageID++ } });
        });

        app.post(`/bot${BOT_TOKEN}/deleteMessage`, (req, res) => {
            this.calls.push({ method: "deleteMessage", body: req.body });

            if (this.deleteShouldFail) {
                res.status(400).json({ ok: false, description: "Bad Request: message to delete not found" });
                return;
            }
            res.json({ ok: true, result: true });
        });

        return new Promise((resolve) => {
            this.server = app.listen(0, () => resolve());
        });
    }

    /**
     * Stop listening
     * @returns {Promise<void>}
     */
    stop() {
        return new Promise((resolve) => this.server.close(resolve));
    }

    /**
     * @returns {string} URL the provider should talk to
     */
    get url() {
        return `http://127.0.0.1:${this.server.address().port}`;
    }

    /**
     * @param {string} method Bot API method
     * @returns {object[]} Calls made to that method
     */
    callsTo(method) {
        return this.calls.filter((call) => call.method === method);
    }
}

const monitorJSON = {
    id: 42,
    name: "Test Monitor",
    type: "http",
    url: "https://example.com",
};

/**
 * @param {number} status UP or DOWN
 * @returns {object} Heartbeat
 */
function heartbeat(status) {
    return {
        status,
        msg: status === DOWN ? "connect ECONNREFUSED" : "200 - OK",
        time: new Date().toISOString(),
    };
}

describe("Telegram cancel notification", () => {
    let mock;
    let telegram;

    /**
     * @param {object} overrides Extra notification config
     * @returns {object} Notification config
     */
    function notification(overrides = {}) {
        return {
            type: "telegram",
            telegramBotToken: BOT_TOKEN,
            telegramChatID: "-100200300",
            telegramServerUrl: mock.url,
            telegramCancelNotification: true,
            telegramCancelNotificationWindow: 300,
            ...overrides,
        };
    }

    before(async () => {
        mock = new MockTelegramServer();
        await mock.start();
    });

    after(async () => {
        await mock.stop();
    });

    beforeEach(() => {
        mock.calls = [];
        mock.nextMessageID = 1;
        mock.deleteShouldFail = false;
        telegram = new Telegram();
    });

    test("deletes the down message and skips the up message on a quick recovery", async () => {
        await telegram.send(notification(), "Down", monitorJSON, heartbeat(DOWN));
        await telegram.send(notification(), "Up", monitorJSON, heartbeat(UP));

        assert.strictEqual(mock.callsTo("sendMessage").length, 1);
        assert.deepStrictEqual(mock.callsTo("deleteMessage")[0].body, {
            chat_id: "-100200300",
            message_id: 1,
        });
        assert.strictEqual(telegram.pendingDownMessages.size, 0);
    });

    test("deletes every down message of the same outage", async () => {
        await telegram.send(notification(), "Down", monitorJSON, heartbeat(DOWN));
        await telegram.send(notification(), "Still down", monitorJSON, heartbeat(DOWN));
        await telegram.send(notification(), "Up", monitorJSON, heartbeat(UP));

        assert.deepStrictEqual(
            mock.callsTo("deleteMessage").map((call) => call.body.message_id),
            [1, 2]
        );
    });

    test("still sends the up message when asked to", async () => {
        const config = notification({ telegramCancelNotificationSendUpMessage: true });

        await telegram.send(config, "Down", monitorJSON, heartbeat(DOWN));
        await telegram.send(config, "Up", monitorJSON, heartbeat(UP));

        assert.strictEqual(mock.callsTo("deleteMessage").length, 1);
        assert.strictEqual(mock.callsTo("sendMessage").length, 2);
    });

    test("sends the up message when the recovery is too late", async () => {
        const config = notification({ telegramCancelNotificationWindow: 1 });

        await telegram.send(config, "Down", monitorJSON, heartbeat(DOWN));

        // Pretend the outage started before the cancellation window
        telegram.pendingDownMessages.get(telegram.getCancelKey(config, monitorJSON)).firstSentAt -= 5000;

        await telegram.send(config, "Up", monitorJSON, heartbeat(UP));

        assert.strictEqual(mock.callsTo("deleteMessage").length, 0);
        assert.strictEqual(mock.callsTo("sendMessage").length, 2);
    });

    test("sends the up message when the down message cannot be deleted", async () => {
        await telegram.send(notification(), "Down", monitorJSON, heartbeat(DOWN));

        mock.deleteShouldFail = true;
        await telegram.send(notification(), "Up", monitorJSON, heartbeat(UP));

        assert.strictEqual(mock.callsTo("deleteMessage").length, 1);
        assert.strictEqual(mock.callsTo("sendMessage").length, 2);
    });

    test("keeps outages of different monitors and chats apart", async () => {
        const otherChat = notification({ telegramChatID: "-100999888" });

        await telegram.send(notification(), "Down", monitorJSON, heartbeat(DOWN));
        await telegram.send(notification(), "Down", { ...monitorJSON, id: 43 }, heartbeat(DOWN));
        await telegram.send(otherChat, "Down", monitorJSON, heartbeat(DOWN));

        assert.strictEqual(telegram.pendingDownMessages.size, 3);

        await telegram.send(notification(), "Up", monitorJSON, heartbeat(UP));

        assert.deepStrictEqual(
            mock.callsTo("deleteMessage").map((call) => call.body.message_id),
            [1]
        );
        assert.strictEqual(telegram.pendingDownMessages.size, 2);
    });

    test("does nothing special while disabled", async () => {
        const config = notification({ telegramCancelNotification: false });

        await telegram.send(config, "Down", monitorJSON, heartbeat(DOWN));
        await telegram.send(config, "Up", monitorJSON, heartbeat(UP));

        assert.strictEqual(mock.callsTo("deleteMessage").length, 0);
        assert.strictEqual(mock.callsTo("sendMessage").length, 2);
        assert.strictEqual(telegram.pendingDownMessages.size, 0);
    });

    test("ignores test notifications, which have no monitor", async () => {
        await telegram.send(notification(), "Testing");

        assert.strictEqual(mock.callsTo("sendMessage").length, 1);
        assert.strictEqual(telegram.pendingDownMessages.size, 0);
    });
});

describe("Telegram.getCancelWindow()", () => {
    const telegram = new Telegram();

    test("falls back to the default when unset or invalid", () => {
        assert.strictEqual(telegram.getCancelWindow({}), 300);
        assert.strictEqual(telegram.getCancelWindow({ telegramCancelNotificationWindow: "" }), 300);
        assert.strictEqual(telegram.getCancelWindow({ telegramCancelNotificationWindow: 0 }), 300);
        assert.strictEqual(telegram.getCancelWindow({ telegramCancelNotificationWindow: -60 }), 300);
    });

    test("caps at the 48 hours Telegram allows deletions for", () => {
        assert.strictEqual(telegram.getCancelWindow({ telegramCancelNotificationWindow: 999999 }), 48 * 60 * 60);
    });
});
