<template>
    <transition ref="tableContainer" name="slide-fade" appear>
        <div v-if="$route.name === 'DashboardHome' || $route.name === 'Events'">
            <h1 v-if="!$root.isMobile" class="mb-3">
                {{ $t("Quick Stats") }}
            </h1>

            <div v-if="!isEventsPage" class="shadow-box big-padding text-center mb-3 quick-stats">
                <div class="row">
                    <div class="col">
                        <h3>{{ $t("Up") }}</h3>
                        <span class="num" :class="$root.stats.up === 0 && 'text-secondary'">
                            {{ $root.stats.up }}
                        </span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("Down") }}</h3>
                        <span class="num" :class="$root.stats.down > 0 ? 'text-danger' : 'text-secondary'">
                            {{ $root.stats.down }}
                        </span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("Maintenance") }}</h3>
                        <span class="num" :class="$root.stats.maintenance > 0 ? 'text-maintenance' : 'text-secondary'">
                            {{ $root.stats.maintenance }}
                        </span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("Unknown") }}</h3>
                        <span class="num text-secondary">{{ $root.stats.unknown }}</span>
                    </div>
                    <div class="col">
                        <h3>{{ $t("pauseDashboardHome") }}</h3>
                        <span class="num text-secondary">{{ $root.stats.pause }}</span>
                    </div>
                </div>
            </div>

            <!-- Mobile home screen: the monitor list. Events live behind the header bell. -->
            <MonitorList v-if="$root.isMobile && !isEventsPage" />

            <div
                v-if="!$root.isMobile || isEventsPage"
                class="shadow-box table-shadow-box table-wrapper"
                :class="{ 'events-mobile': $root.isMobile }"
            >
                <div class="mb-3 events-header">
                    <h2 v-if="$root.isMobile" class="events-title">{{ $t("Events") }}</h2>
                    <button
                        class="btn btn-sm btn-outline-danger"
                        :disabled="clearingAllEvents"
                        @click="clearAllEventsDialog"
                    >
                        {{ $t("Clear All Events") }}
                    </button>
                </div>
                <EventListMobile v-if="$root.isMobile" :records="displayedRecords" show-name />
                <table v-else class="table table-borderless table-hover">
                    <thead>
                        <tr>
                            <th v-if="showGroupColumn">{{ $t("Group Name") }}</th>
                            <th class="name-column">{{ $t("Name") }}</th>
                            <th>{{ $t("Status") }}</th>
                            <th>{{ $t("DateTime") }}</th>
                            <th>{{ $t("Message") }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="(beat, index) in displayedRecords"
                            :key="index"
                            :class="{ 'shadow-box': $root.windowWidth <= 550 }"
                        >
                            <td v-if="showGroupColumn">
                                <router-link
                                    v-if="getGroupName(beat.monitorID)"
                                    :to="`/dashboard/${getGroupId(beat.monitorID)}`"
                                >
                                    {{ getGroupName(beat.monitorID) }}
                                </router-link>
                                <span v-else class="text-secondary">—</span>
                            </td>
                            <td class="name-column">
                                <router-link :to="`/dashboard/${beat.monitorID}`">
                                    {{ $root.monitorList[beat.monitorID]?.name }}
                                </router-link>
                            </td>
                            <td><Status :status="beat.status" /></td>
                            <td :class="{ 'border-0': !beat.msg }"><Datetime :value="beat.time" /></td>
                            <td class="border-0">{{ beat.msg }}</td>
                        </tr>

                        <tr v-if="importantHeartBeatListLength === 0">
                            <td :colspan="tableColumnCount">
                                {{ $t("No important events") }}
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div class="d-flex justify-content-center kuma_pagination">
                    <pagination
                        v-model="page"
                        :records="importantHeartBeatListLength"
                        :per-page="perPage"
                        :options="paginationConfig"
                    />
                </div>
            </div>
        </div>
    </transition>
    <Confirm
        ref="confirmClearEvents"
        btn-style="btn-danger"
        :yes-text="$t('Yes')"
        :no-text="$t('No')"
        @yes="clearAllEvents"
    >
        {{ $t("clearAllEventsMsg") }}
    </Confirm>
    <router-view ref="child" />
</template>

<script>
import Status from "../components/Status.vue";
import Datetime from "../components/Datetime.vue";
import Pagination from "v-pagination-3";
import Confirm from "../components/Confirm.vue";
import EventListMobile from "../components/EventListMobile.vue";
import MonitorList from "../components/MonitorList.vue";

export default {
    components: {
        Datetime,
        Status,
        Pagination,
        Confirm,
        EventListMobile,
        MonitorList,
    },
    props: {
        calculatedHeight: {
            type: Number,
            default: 0,
        },
    },
    data() {
        return {
            page: 1,
            perPage: 25,
            initialPerPage: 25,
            paginationConfig: {
                hideCount: true,
                chunksNavigation: "scroll",
            },
            importantHeartBeatListLength: 0,
            displayedRecords: [],
            clearingAllEvents: false,
        };
    },
    computed: {
        isEventsPage() {
            return this.$route.name === "Events";
        },

        showGroupColumn() {
            return Object.values(this.$root.monitorList).some((m) => m.parent != null);
        },
        tableColumnCount() {
            return this.showGroupColumn ? 5 : 4;
        },
    },
    watch: {
        "$root.isMobile"(isMobile) {
            if (!isMobile && this.isEventsPage) {
                this.$router.replace("/dashboard");
            }
        },

        perPage() {
            this.$nextTick(() => {
                this.getImportantHeartbeatListPaged();
            });
        },

        page() {
            this.getImportantHeartbeatListPaged();
        },
    },

    mounted() {
        // The events page is a mobile screen; desktop shows events on the dashboard
        if (this.isEventsPage && !this.$root.isMobile) {
            this.$router.replace("/dashboard");
            return;
        }

        this.getImportantHeartbeatListLength();

        this.$root.emitter.on("newImportantHeartbeat", this.onNewImportantHeartbeat);

        this.initialPerPage = this.perPage;

        window.addEventListener("resize", this.updatePerPage);
        this.updatePerPage();
    },

    beforeUnmount() {
        this.$root.emitter.off("newImportantHeartbeat", this.onNewImportantHeartbeat);

        window.removeEventListener("resize", this.updatePerPage);
    },

    methods: {
        /**
         * Returns the group (parent) name for a monitor, or empty string if none.
         * @param {number} monitorID - The monitor ID.
         * @returns {string} The group name or empty string.
         */
        getGroupName(monitorID) {
            const monitor = this.$root.monitorList[monitorID];
            if (!monitor || monitor.parent == null) {
                return "";
            }
            const parent = this.$root.monitorList[monitor.parent];
            return parent ? parent.name : "";
        },

        /**
         * Returns the group (parent) ID for a monitor, or null if none.
         * @param {number} monitorID - The monitor ID.
         * @returns {number|null} The group monitor ID or null.
         */
        getGroupId(monitorID) {
            const monitor = this.$root.monitorList[monitorID];
            return monitor && monitor.parent != null ? monitor.parent : null;
        },

        /**
         * Updates the displayed records when a new important heartbeat arrives.
         * @param {object} heartbeat - The heartbeat object received.
         * @returns {void}
         */
        onNewImportantHeartbeat(heartbeat) {
            if (this.page === 1) {
                this.displayedRecords.unshift(heartbeat);
                if (this.displayedRecords.length > this.perPage) {
                    this.displayedRecords.pop();
                }
                this.importantHeartBeatListLength += 1;
            }
        },

        /**
         * Retrieves the length of the important heartbeat list for all monitors.
         * @returns {void}
         */
        getImportantHeartbeatListLength() {
            this.$root.getSocket().emit("monitorImportantHeartbeatListCount", null, (res) => {
                if (res.ok) {
                    this.importantHeartBeatListLength = res.count;
                    this.getImportantHeartbeatListPaged();
                }
            });
        },

        /**
         * Retrieves the important heartbeat list for the current page.
         * @returns {void}
         */
        getImportantHeartbeatListPaged() {
            const offset = (this.page - 1) * this.perPage;
            this.$root.getSocket().emit("monitorImportantHeartbeatListPaged", null, offset, this.perPage, (res) => {
                if (res.ok) {
                    this.displayedRecords = res.data;
                }
            });
        },

        /**
         * Updates the number of items shown per page based on the available height.
         * @returns {void}
         */
        updatePerPage() {
            const tableContainer = this.$refs.tableContainer;
            const tableContainerHeight = tableContainer.offsetHeight;
            const availableHeight = window.innerHeight - tableContainerHeight;
            const additionalPerPage = Math.floor(availableHeight / 58);

            if (additionalPerPage > 0) {
                this.perPage = Math.max(this.initialPerPage, this.perPage + additionalPerPage);
            } else {
                this.perPage = this.initialPerPage;
            }
        },

        clearAllEventsDialog() {
            this.$refs.confirmClearEvents.show();
        },
        clearAllEvents() {
            this.clearingAllEvents = true;
            const monitorIDs = Object.keys(this.$root.monitorList);
            let failed = 0;
            const total = monitorIDs.length;

            if (total === 0) {
                this.clearingAllEvents = false;
                this.$root.toastError(this.$t("No monitors found"));
                return;
            }

            monitorIDs.forEach((monitorID) => {
                this.$root.getSocket().emit("clearEvents", monitorID, (res) => {
                    if (!res || !res.ok) {
                        failed++;
                    }
                });
            });
            this.clearingAllEvents = false;
            this.page = 1;
            this.getImportantHeartbeatListLength();
            if (failed === 0) {
                this.$root.toastSuccess(this.$t("Events cleared successfully"));
            } else {
                this.$root.toastError(
                    this.$t("Could not clear events", {
                        failed,
                        total,
                    })
                );
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.num {
    font-size: 30px;
    color: $primary;
    font-weight: bold;
    display: block;
}

.shadow-box {
    padding: 20px;
}

table {
    font-size: 14px;

    tr {
        transition: all ease-in-out 0.2ms;
    }

    @media (max-width: 550px) {
        table-layout: fixed;
        overflow-wrap: break-word;
    }
}

@media screen and (max-width: 1280px) {
    .name-column {
        min-width: 150px;
    }
}

@media screen and (min-aspect-ratio: 4/3) {
    .name-column {
        min-width: 200px;
    }
}

.table-wrapper {
    overflow-x: auto;
}

.events-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
}

@media (max-width: 767.98px) {
    // One compact strip instead of a 3+2 grid of oversized headings
    .quick-stats {
        padding: 14px 6px !important;

        .row {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            margin: 0;

            > .col {
                padding: 0 2px;
                display: flex;
                flex-direction: column-reverse;
                gap: 2px;

                & + .col {
                    border-left: 1px solid rgba(0, 0, 0, 0.06);

                    .dark & {
                        border-left-color: $dark-border-color;
                    }
                }
            }
        }

        h3 {
            font-size: 11px;
            font-weight: 500;
            letter-spacing: 0.01em;
            color: $secondary-text;
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .num {
            font-size: 24px;
            line-height: 1.2;
            font-variant-numeric: tabular-nums;
        }
    }

    .events-mobile {
        padding: 12px 14px 8px !important;
        overflow: visible;

        .events-header {
            justify-content: space-between;
            margin-bottom: 4px !important;
        }

        .events-title {
            font-size: 1.05rem;
            font-weight: 700;
            margin: 0;
        }
    }
}
</style>
