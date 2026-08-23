const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const crypto = require("crypto");
const { log, UP, DOWN } = require("../../src/util");

/**
 * Telegram bots are only allowed to delete their own messages while they are
 * less than 48 hours old, so a longer cancellation window would be useless.
 * https://core.telegram.org/bots/api#deletemessage
 */
const MAX_CANCEL_WINDOW = 48 * 60 * 60;

/**
 * Cancellation window used when the notification does not specify one
 */
const DEFAULT_CANCEL_WINDOW = 300;

class Telegram extends NotificationProvider {
    name = "telegram";

    /**
     * Down messages that are still eligible for cancellation, keyed by chat and monitor.
     * Kept in memory only, so a restart simply leaves the already sent messages in place.
     * @type {Map<string, { messageIDs: number[], firstSentAt: number, windowMs: number }>}
     */
    pendingDownMessages = new Map();

    /**
     * Escapes special characters for Telegram MarkdownV2 format
     * @param {string} text Text to escape
     * @returns {string} Escaped text
     */
    escapeMarkdownV2(text) {
        if (!text) {
            return text;
        }

        // Characters that need to be escaped in MarkdownV2
        // https://core.telegram.org/bots/api#markdownv2-style
        return String(text).replace(/[_*[\]()~>#+\-=|{}.!\\]/g, "\\$&");
    }

    /**
     * Recursively escapes string properties of an object for Telegram MarkdownV2
     * @param {object|string} obj Object or string to escape
     * @returns {object|string} Escaped object or string
     */
    escapeObjectRecursive(obj) {
        if (typeof obj === "string") {
            return this.escapeMarkdownV2(obj);
        }
        if (typeof obj === "object" && obj !== null) {
            // Check if array
            if (Array.isArray(obj)) {
                return obj.map((item) => this.escapeObjectRecursive(item));
            }

            const newObj = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    newObj[key] = this.escapeObjectRecursive(obj[key]);
                }
            }
            return newObj;
        }
        return obj;
    }

    /**
     * Key identifying the down messages of one monitor in one chat.
     * The bot token is hashed as it is a secret that should not end up in logs.
     * @param {BeanModel} notification Notification to send
     * @param {object} monitorJSON Monitor details
     * @returns {string} Key of the pending down messages
     */
    getCancelKey(notification, monitorJSON) {
        const bot = crypto
            .createHash("sha256")
            .update(String(notification.telegramBotToken ?? ""))
            .digest("hex")
            .substring(0, 12);

        return [bot, notification.telegramChatID, notification.telegramMessageThreadID ?? "", monitorJSON["id"]].join(
            ":"
        );
    }

    /**
     * Time a monitor may stay down before its down message stops being cancellable
     * @param {BeanModel} notification Notification to send
     * @returns {number} Cancellation window in seconds
     */
    getCancelWindow(notification) {
        const window = parseInt(notification.telegramCancelNotificationWindow, 10);

        if (!Number.isFinite(window) || window <= 0) {
            return DEFAULT_CANCEL_WINDOW;
        }
        return Math.min(window, MAX_CANCEL_WINDOW);
    }

    /**
     * Forget down messages that outlived their cancellation window
     * @returns {void}
     */
    prunePendingDownMessages() {
        const now = Date.now();

        for (const [key, pending] of this.pendingDownMessages) {
            if (now - pending.firstSentAt > pending.windowMs) {
                this.pendingDownMessages.delete(key);
            }
        }
    }

    /**
     * Remember a down message so that it can be deleted on recovery
     * @param {BeanModel} notification Notification to send
     * @param {string} key Key of the pending down messages
     * @param {?number} messageID ID of the message sent to Telegram
     * @returns {void}
     */
    rememberDownMessage(notification, key, messageID) {
        if (!messageID) {
            return;
        }

        const pending = this.pendingDownMessages.get(key);

        // Resent down notifications belong to the same outage as the first one
        if (pending) {
            pending.messageIDs.push(messageID);
        } else {
            this.pendingDownMessages.set(key, {
                messageIDs: [messageID],
                firstSentAt: Date.now(),
                windowMs: this.getCancelWindow(notification) * 1000,
            });
        }
    }

    /**
     * Delete the down messages of a monitor if it recovered within the cancellation window
     * @param {string} url Telegram server URL
     * @param {BeanModel} notification Notification to send
     * @param {string} key Key of the pending down messages
     * @param {object} config Axios config
     * @returns {Promise<boolean>} Were all down messages deleted?
     */
    async cancelDownMessages(url, notification, key, config) {
        const pending = this.pendingDownMessages.get(key);

        if (!pending) {
            return false;
        }
        this.pendingDownMessages.delete(key);

        if (Date.now() - pending.firstSentAt > pending.windowMs) {
            return false;
        }

        try {
            for (const messageID of pending.messageIDs) {
                await axios.post(
                    `${url}/bot${notification.telegramBotToken}/deleteMessage`,
                    {
                        chat_id: notification.telegramChatID,
                        message_id: messageID,
                    },
                    config
                );
            }
            return true;
        } catch (error) {
            // The message may already be gone or too old to delete, keep the up message in that case
            log.warn("notification", "Telegram: cannot delete the down message: " + error.message);
            return false;
        }
    }

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        const url = notification.telegramServerUrl ?? "https://api.telegram.org";
        const config = this.getAxiosConfigWithProxy();

        // Cancellation needs a monitor to key the messages on and a status to act on
        const cancelEnabled = !!notification.telegramCancelNotification && !!monitorJSON && !!heartbeatJSON;
        const cancelKey = cancelEnabled ? this.getCancelKey(notification, monitorJSON) : null;

        if (cancelEnabled) {
            this.prunePendingDownMessages();
        }

        try {
            if (cancelEnabled && heartbeatJSON["status"] === UP) {
                const cancelled = await this.cancelDownMessages(url, notification, cancelKey, config);

                if (cancelled && !notification.telegramCancelNotificationSendUpMessage) {
                    return "Recovered in time, the down message has been deleted.";
                }
            }

            let params = {
                chat_id: notification.telegramChatID,
                text: msg,
                disable_notification: notification.telegramSendSilently ?? false,
                protect_content: notification.telegramProtectContent ?? false,
                link_preview_options: { is_disabled: true },
            };
            if (notification.telegramMessageThreadID) {
                params.message_thread_id = notification.telegramMessageThreadID;
            }

            if (notification.telegramUseTemplate) {
                let monitorJSONCopy = monitorJSON;
                let heartbeatJSONCopy = heartbeatJSON;

                if (notification.telegramTemplateParseMode === "MarkdownV2") {
                    msg = this.escapeMarkdownV2(msg);

                    if (monitorJSONCopy) {
                        monitorJSONCopy = this.escapeObjectRecursive(monitorJSONCopy);
                    } else {
                        // for testing monitorJSON is null, provide escaped defaults
                        monitorJSONCopy = {
                            name: this.escapeMarkdownV2("Monitor Name not available"),
                            hostname: this.escapeMarkdownV2("testing.hostname"),
                            url: this.escapeMarkdownV2("testing.hostname"),
                        };
                    }

                    if (heartbeatJSONCopy) {
                        heartbeatJSONCopy = this.escapeObjectRecursive(heartbeatJSONCopy);
                    }
                }

                params.text = await this.renderTemplate(
                    notification.telegramTemplate,
                    msg,
                    monitorJSONCopy,
                    heartbeatJSONCopy
                );

                if (notification.telegramTemplateParseMode !== "plain") {
                    params.parse_mode = notification.telegramTemplateParseMode;
                }
            }

            const res = await axios.post(`${url}/bot${notification.telegramBotToken}/sendMessage`, params, config);

            if (cancelEnabled && heartbeatJSON["status"] === DOWN) {
                this.rememberDownMessage(notification, cancelKey, res.data?.result?.message_id);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Telegram;
