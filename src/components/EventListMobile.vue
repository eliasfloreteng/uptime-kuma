<template>
    <ul class="event-list">
        <li v-for="(beat, index) in records" :key="index">
            <component
                :is="showName ? 'router-link' : 'div'"
                :to="showName ? `/dashboard/${beat.monitorID}` : undefined"
                class="event"
                :class="{ tappable: showName }"
            >
                <span class="dot" :class="'bg-' + statusColor(beat.status)" />
                <div class="body">
                    <div class="headline">
                        <span v-if="showName" class="name">
                            <span v-if="groupName(beat.monitorID)" class="group">
                                {{ groupName(beat.monitorID) }} /
                            </span>
                            {{ $root.monitorList[beat.monitorID]?.name }}
                        </span>
                        <span v-else class="name" :class="'text-' + statusColor(beat.status)">
                            {{ statusText(beat.status) }}
                        </span>
                        <time :datetime="beat.time" :title="$root.datetime(beat.time)">
                            {{ shortTime(beat.time) }}
                        </time>
                    </div>
                    <div v-if="beat.msg || showName" class="msg">
                        <span v-if="showName" :class="'text-' + statusColor(beat.status)" class="status-word">
                            {{ statusText(beat.status) }}
                        </span>
                        <span v-if="showName && beat.msg" class="sep" aria-hidden="true">·</span>
                        {{ beat.msg }}
                    </div>
                </div>
            </component>
        </li>

        <li v-if="records.length === 0" class="empty">
            {{ $t("No important events") }}
        </li>
    </ul>
</template>

<script>
import { DOWN, UP, PENDING, MAINTENANCE } from "../util.ts";

export default {
    props: {
        /** Important heartbeats to list */
        records: {
            type: Array,
            required: true,
        },
        /** Show the monitor name (dashboard) instead of only the status (monitor details) */
        showName: {
            type: Boolean,
            default: false,
        },
    },

    methods: {
        /**
         * Bootstrap color name for a heartbeat status
         * @param {number} status Heartbeat status
         * @returns {string} Color name
         */
        statusColor(status) {
            switch (status) {
                case DOWN:
                    return "danger";
                case UP:
                    return "primary";
                case PENDING:
                    return "warning";
                case MAINTENANCE:
                    return "maintenance";
                default:
                    return "secondary";
            }
        },

        /**
         * Translated label for a heartbeat status
         * @param {number} status Heartbeat status
         * @returns {string} Label
         */
        statusText(status) {
            switch (status) {
                case DOWN:
                    return this.$t("Down");
                case UP:
                    return this.$t("Up");
                case PENDING:
                    return this.$t("Pending");
                case MAINTENANCE:
                    return this.$t("statusMaintenance");
                default:
                    return this.$t("Unknown");
            }
        },

        /**
         * Name of the group a monitor belongs to, if any
         * @param {number} monitorID Monitor ID
         * @returns {string|null} Group name
         */
        groupName(monitorID) {
            const parent = this.$root.monitorList[monitorID]?.parent;
            return parent ? this.$root.monitorList[parent]?.name : null;
        },

        /**
         * Compact timestamp: time only for today, date and time otherwise
         * @param {string} value Heartbeat time (UTC)
         * @returns {string} Formatted time
         */
        shortTime(value) {
            const time = this.$root.toDayjs(value);
            const now = this.$root.toDayjs(new Date().toISOString());
            if (time.isSame(now, "day")) {
                return time.format("HH:mm");
            }
            if (time.isSame(now, "year")) {
                return time.format("MMM D, HH:mm");
            }
            return time.format("YYYY-MM-DD");
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.event-list {
    list-style: none;
    margin: 0;
    padding: 0;

    li + li {
        border-top: 1px solid rgba(0, 0, 0, 0.06);

        .dark & {
            border-top-color: $dark-border-color;
        }
    }
}

.event {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 4px;
    color: inherit;
    text-decoration: none;
    border-radius: 10px;
    transition: background-color 120ms $easing-out;

    &.tappable:active {
        background-color: rgba(0, 0, 0, 0.04);

        .dark & {
            background-color: rgba(255, 255, 255, 0.04);
        }
    }
}

.dot {
    flex: none;
    width: 10px;
    height: 10px;
    margin-top: 6px;
    border-radius: 50%;
}

.body {
    flex: 1;
    min-width: 0;
}

.headline {
    display: flex;
    align-items: baseline;
    gap: 8px;
}

.name {
    flex: 1;
    min-width: 0;
    font-weight: 600;
    font-size: 15px;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.group {
    font-weight: 400;
    color: $secondary-text;
}

time {
    flex: none;
    font-size: 13px;
    color: $secondary-text;
    font-variant-numeric: tabular-nums;
}

.msg {
    margin-top: 2px;
    font-size: 14px;
    line-height: 1.4;
    color: #555;
    overflow-wrap: anywhere;

    .dark & {
        color: $dark-font-color;
    }
}

.status-word {
    font-weight: 600;
}

.text-danger {
    .dark & {
        color: #ff6b77 !important;
    }
}

// The brand green is too light for text on white; darken it for legibility.
.text-primary {
    color: #177a3f !important;

    .dark & {
        color: $primary !important;
    }
}

.sep {
    margin: 0 2px;
    color: $secondary-text;
}

.empty {
    padding: 24px 4px;
    text-align: center;
    color: $secondary-text;
}
</style>
