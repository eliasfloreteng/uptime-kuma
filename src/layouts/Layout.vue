<template>
    <div :class="classes">
        <div v-if="!$root.socket.connected && !$root.socket.firstConnect" class="lost-connection">
            <div class="container-fluid">
                {{ $root.connectionErrorMsg }}
                <div v-if="$root.showReverseProxyGuide">
                    {{ $t("Using a Reverse Proxy?") }}
                    <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy" target="_blank">
                        {{ $t("Check how to config it for WebSocket") }}
                    </a>
                </div>
            </div>
        </div>

        <!-- Desktop header -->
        <header v-if="!$root.isMobile" class="d-flex flex-wrap justify-content-center py-3 mb-3 border-bottom">
            <router-link
                to="/dashboard"
                class="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none"
            >
                <object class="bi me-2 ms-4" width="40" height="40" data="/icon.svg" />
                <span class="fs-4 title">{{ $t("Uptime Kuma") }}</span>
            </router-link>

            <a
                v-if="hasNewVersion"
                target="_blank"
                href="https://github.com/louislam/uptime-kuma/releases"
                class="btn btn-primary me-3"
            >
                <font-awesome-icon icon="arrow-alt-circle-up" />
                {{ $t("New Update") }}
            </a>

            <ul class="nav nav-pills">
                <li v-if="$root.loggedIn" class="nav-item me-2">
                    <router-link to="/manage-status-page" class="nav-link">
                        <font-awesome-icon icon="stream" />
                        {{ $t("Status Pages") }}
                    </router-link>
                </li>
                <li v-if="$root.loggedIn" class="nav-item me-2">
                    <router-link to="/dashboard" class="nav-link">
                        <font-awesome-icon icon="tachometer-alt" />
                        {{ $t("Dashboard") }}
                    </router-link>
                </li>
                <li v-if="$root.loggedIn" class="nav-item">
                    <div class="dropdown dropdown-profile-pic">
                        <div class="nav-link" data-bs-toggle="dropdown">
                            <div class="profile-pic">{{ $root.usernameFirstChar }}</div>
                            <font-awesome-icon icon="angle-down" />
                        </div>

                        <!-- Header's Dropdown Menu -->
                        <ul class="dropdown-menu">
                            <!-- Username -->
                            <li>
                                <i18n-t
                                    v-if="$root.username != null"
                                    tag="span"
                                    keypath="signedInDisp"
                                    class="dropdown-item-text"
                                >
                                    <strong>{{ $root.username }}</strong>
                                </i18n-t>
                                <span v-if="$root.username == null" class="dropdown-item-text">
                                    {{ $t("signedInDispDisabled") }}
                                </span>
                            </li>

                            <li><hr class="dropdown-divider" /></li>

                            <!-- Functions -->
                            <li>
                                <router-link
                                    to="/maintenance"
                                    class="dropdown-item"
                                    :class="{ active: $route.path.includes('manage-maintenance') }"
                                >
                                    <font-awesome-icon icon="wrench" />
                                    {{ $t("Maintenance") }}
                                </router-link>
                            </li>

                            <li>
                                <router-link
                                    to="/settings/general"
                                    class="dropdown-item"
                                    :class="{ active: $route.path.includes('settings') }"
                                >
                                    <font-awesome-icon icon="cog" />
                                    {{ $t("Settings") }}
                                </router-link>
                            </li>

                            <li>
                                <a
                                    href="https://github.com/louislam/uptime-kuma/wiki"
                                    class="dropdown-item"
                                    target="_blank"
                                >
                                    <font-awesome-icon icon="info-circle" />
                                    {{ $t("Help") }}
                                </a>
                            </li>

                            <li v-if="$root.loggedIn && $root.socket.token !== 'autoLogin'">
                                <button class="dropdown-item" @click="$root.logout">
                                    <font-awesome-icon icon="sign-out-alt" />
                                    {{ $t("Logout") }}
                                </button>
                            </li>
                        </ul>
                    </div>
                </li>
            </ul>
        </header>

        <!-- Mobile header -->
        <header v-else class="mobile-header">
            <button v-if="showBackButton" type="button" class="header-back" :aria-label="$t('Back')" @click="goBack">
                <font-awesome-icon icon="chevron-left" />
            </button>
            <router-link to="/dashboard" class="header-brand">
                <img src="/icon.svg" width="28" height="28" alt="" />
                <span class="title">{{ $t("Uptime Kuma") }}</span>
            </router-link>

            <router-link
                v-if="$root.loggedIn"
                to="/events"
                class="header-action"
                active-class=""
                exact-active-class=""
                :class="{ 'is-active': $route.name === 'Events' }"
                :aria-label="unseenEvents > 0 ? `${$t('Events')} (${unseenEvents})` : $t('Events')"
            >
                <font-awesome-icon icon="bell" />
                <span v-if="unseenEvents > 0" class="action-badge">{{ unseenEventsLabel }}</span>
            </router-link>
        </header>

        <main>
            <router-view v-if="$root.loggedIn" />
            <Login v-if="!$root.loggedIn && $root.allowLoginDialog" />
        </main>

        <!-- Mobile Only -->
        <div v-if="$root.isMobile" class="bottom-nav-spacer" />
        <nav v-if="$root.isMobile && $root.loggedIn" class="bottom-nav">
            <router-link
                v-for="tab in mobileTabs"
                :key="tab.to"
                :to="tab.to"
                class="tab"
                active-class=""
                exact-active-class=""
                :class="{ 'is-active': activeTab === tab.to }"
                :aria-current="activeTab === tab.to ? 'page' : undefined"
                @click="onTabClick(tab)"
            >
                <span class="tab-icon">
                    <font-awesome-icon :icon="tab.icon" />
                    <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
                </span>
                <span class="tab-label">{{ tab.label }}</span>
            </router-link>
        </nav>

        <button
            v-if="numActiveToasts != 0"
            type="button"
            class="btn btn-normal clear-all-toast-btn"
            @click="clearToasts"
        >
            <font-awesome-icon icon="times" />
        </button>
    </div>
</template>

<script>
import Login from "../components/Login.vue";
import compareVersions from "compare-versions";
import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    components: {
        Login,
    },

    data() {
        return {
            toastContainer: null,
            numActiveToasts: 0,
            unseenEvents: 0,
            toastContainerObserver: null,
        };
    },

    computed: {
        // Theme or Mobile
        classes() {
            const classes = {};
            classes[this.$root.theme] = true;
            classes["mobile"] = this.$root.isMobile;
            return classes;
        },

        /**
         * Tabs of the mobile bottom navigation. The monitor list is the home
         * screen; its badge counts monitors that are down right now.
         * @returns {object[]} Tabs
         */
        mobileTabs() {
            return [
                {
                    to: "/dashboard",
                    icon: "list",
                    label: this.$t("monitorsTab"),
                    badge: this.$root.stats.down > 0 ? this.$root.stats.down : null,
                },
                { to: "/add", icon: "plus", label: this.$t("Add") },
                { to: "/settings", icon: "cog", label: this.$t("Settings") },
            ];
        },

        /**
         * Which bottom tab a route belongs to
         * @returns {string|null} Path of the active tab
         */
        activeTab() {
            const path = this.$route.path;
            if (path === "/add") {
                return "/add";
            }
            if (path === "/dashboard" || path === "/events" || /^\/(dashboard|edit|clone)\/\d+/.test(path)) {
                return "/dashboard";
            }
            if (/^\/(settings|maintenance|manage-status-page|add-status-page|add-maintenance)/.test(path)) {
                return "/settings";
            }
            return null;
        },

        /**
         * Show a back button on pages below a tab's root
         * @returns {boolean} Whether to show it
         */
        showBackButton() {
            return this.$root.loggedIn && !["/dashboard", "/add", "/settings"].includes(this.$route.path);
        },

        unseenEventsLabel() {
            return this.unseenEvents > 99 ? "99+" : String(this.unseenEvents);
        },

        hasNewVersion() {
            if (this.$root.info.latestVersion && this.$root.info.version) {
                return compareVersions(this.$root.info.latestVersion, this.$root.info.version) >= 1;
            } else {
                return false;
            }
        },
    },

    watch: {
        "$root.loggedIn": {
            immediate: true,
            handler(loggedIn) {
                if (loggedIn) {
                    this.countUnseenEvents();
                }
            },
        },

        "$route.name": {
            immediate: true,
            handler(name) {
                if (name === "Events") {
                    this.markEventsSeen();
                }
            },
        },
    },

    created() {
        this.$root.emitter.on("newImportantHeartbeat", this.onNewImportantHeartbeat);
    },

    mounted() {
        this.toastContainer = document.querySelector(".bottom-right.toast-container");

        // Watch the number of active toasts
        this.toastContainerObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === "childList") {
                    this.numActiveToasts = mutation.target.children.length;
                }
            }
        });

        if (this.toastContainer != null) {
            this.toastContainerObserver.observe(this.toastContainer, { childList: true });
        }
    },

    beforeUnmount() {
        this.toastContainerObserver.disconnect();
        this.$root.emitter.off("newImportantHeartbeat", this.onNewImportantHeartbeat);
    },

    methods: {
        /**
         * Clear all toast notifications.
         * @returns {void}
         */
        clearToasts() {
            toast.clear();
        },

        /**
         * Tapping the tab you are already on scrolls back to the top, like a
         * native tab bar
         * @param {object} tab Tapped tab
         * @returns {void}
         */
        onTabClick(tab) {
            if (this.$route.path === tab.to) {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        },

        /**
         * Count important events newer than the last visit to the events page.
         * The first visit ever starts from zero rather than flagging all history.
         * @returns {void}
         */
        countUnseenEvents() {
            const seenAt = Number(localStorage.eventsSeenAt);
            if (!seenAt) {
                this.markEventsSeen();
                return;
            }
            this.$root.getSocket().emit("monitorImportantHeartbeatListPaged", null, 0, 100, (res) => {
                if (res.ok) {
                    this.unseenEvents = res.data.filter(
                        (beat) => this.$root.toDayjs(beat.time).valueOf() > seenAt
                    ).length;
                }
            });
        },

        /**
         * A new important event arrived over the socket
         * @returns {void}
         */
        onNewImportantHeartbeat() {
            if (this.$route.name === "Events") {
                this.markEventsSeen();
            } else {
                this.unseenEvents++;
            }
        },

        /**
         * Reset the unseen counter
         * @returns {void}
         */
        markEventsSeen() {
            localStorage.eventsSeenAt = Date.now();
            this.unseenEvents = 0;
        },

        /**
         * Navigate back, or to the tab root when there is no in-app history
         * @returns {void}
         */
        goBack() {
            if (window.history.state?.back) {
                this.$router.back();
            } else {
                this.$router.push(this.activeTab ?? "/dashboard");
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.nav-link {
    @media (hover: hover) and (pointer: fine) {
        &:hover {
            background-color: $primary;
            color: #fff;

            .dark & {
                background-color: $primary;
                color: #000;
            }

            &.active {
                background-color: $highlight;
            }
        }
    }

    &.status-page {
        background-color: rgba(255, 255, 255, 0.1);
    }
}

// Mobile app bar: compact, sticky, painted under the notch
.mobile-header {
    position: sticky;
    top: 0;
    z-index: 1010;
    display: flex;
    align-items: center;
    gap: 6px;
    min-height: calc(52px + env(safe-area-inset-top));
    padding: env(safe-area-inset-top) max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left));
    margin-bottom: 12px;
    background-color: $mobile-chrome-bg;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);

    .header-back {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        margin-left: -8px;
        border: 0;
        border-radius: 50%;
        background: none;
        color: inherit;
        font-size: 18px;
        transition: background-color 120ms $easing-out;

        &:active {
            background-color: rgba(0, 0, 0, 0.06);
        }
    }

    .header-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        color: #111;
        text-decoration: none;

        .title {
            font-size: 17px;
            font-weight: 700;
            white-space: nowrap;
        }
    }

    .header-action {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        margin-left: auto;
        margin-right: -8px;
        border-radius: 50%;
        color: #555b63;
        font-size: 19px;
        text-decoration: none;
        transition:
            background-color 120ms $easing-out,
            transform 120ms $easing-out;

        &:active {
            transform: scale(0.92);
            background-color: rgba(0, 0, 0, 0.06);
        }

        &.is-active {
            color: #1c9a4f;
        }
    }

    .action-badge {
        position: absolute;
        top: 3px;
        left: 21px;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 9px;
        background-color: $danger;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        line-height: 18px;
        text-align: center;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 0 0 2px $mobile-chrome-bg;
    }
}

.bottom-nav-spacer {
    height: calc(64px + env(safe-area-inset-bottom));
}

.bottom-nav {
    z-index: 1000;
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    display: flex;
    padding: 0 max(4px, env(safe-area-inset-right)) env(safe-area-inset-bottom) max(4px, env(safe-area-inset-left));
    background-color: $mobile-chrome-bg;
    border-top: 1px solid rgba(0, 0, 0, 0.08);

    .tab {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        height: 56px;
        font-size: 11px;
        font-weight: 500;
        color: #8a8f98;
        text-decoration: none;
        transition: color 120ms $easing-out;

        .tab-icon {
            position: relative;
            font-size: 20px;
            line-height: 1;
            transition: transform 120ms $easing-out;
        }

        &:active .tab-icon {
            transform: scale(0.88);
        }

        .tab-label {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        &.is-active {
            color: #1c9a4f;
            font-weight: 700;
        }
    }

    .tab-badge {
        position: absolute;
        top: -6px;
        left: calc(100% - 4px);
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 9px;
        background-color: $danger;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        line-height: 18px;
        text-align: center;
        font-variant-numeric: tabular-nums;
        box-shadow: 0 0 0 2px $mobile-chrome-bg;
    }
}

main {
    min-height: calc(100vh - 160px);
    min-height: calc(100dvh - 160px);
}

.title {
    font-weight: bold;
}

.nav {
    margin-right: 25px;
}

.lost-connection {
    padding: 5px;
    background-color: crimson;
    color: white;
    position: fixed;
    width: 100%;
    z-index: 99999;
}

// Profile Pic Button with Dropdown
.dropdown-profile-pic {
    user-select: none;

    .nav-link {
        cursor: pointer;
        display: flex;
        gap: 6px;
        align-items: center;
        background-color: rgba(200, 200, 200, 0.2);
        padding: 0.5rem 0.8rem;

        &:hover {
            background-color: rgba(255, 255, 255, 0.2);
        }
    }

    .dropdown-menu {
        transition: all 0.2s;
        padding-left: 0;
        padding-bottom: 0;
        margin-top: 8px !important;
        border-radius: 16px;
        overflow: hidden;

        .dropdown-divider {
            margin: 0;
            border-top: 1px solid rgba(0, 0, 0, 0.4);
            background-color: transparent;
        }

        .dropdown-item-text {
            font-size: 14px;
            padding-bottom: 0.7rem;
        }

        .dropdown-item {
            padding: 0.7rem 1rem;
        }

        .dark & {
            background-color: $dark-bg;
            color: $dark-font-color;
            border-color: $dark-border-color;

            .dropdown-item {
                color: $dark-font-color;

                &.active {
                    color: $dark-font-color2;
                    background-color: $highlight !important;
                }

                &:hover {
                    background-color: $dark-bg2;
                }
            }
        }
    }

    .profile-pic {
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        background-color: $primary;
        width: 24px;
        height: 24px;
        margin-right: 5px;
        border-radius: 50rem;
        font-weight: bold;
        font-size: 10px;
    }
}

.dark {
    header {
        background-color: $dark-header-bg;
        border-bottom-color: $dark-header-bg !important;

        span {
            color: #f0f6fc;
        }
    }

    .mobile-header {
        background-color: $dark-header-bg;
        border-bottom-color: $dark-border-color;

        .header-brand {
            color: #f0f6fc;
        }

        .header-back:active {
            background-color: rgba(255, 255, 255, 0.08);
        }

        .header-action {
            color: $dark-font-color;

            &:active {
                background-color: rgba(255, 255, 255, 0.08);
            }

            &.is-active {
                color: $primary;
            }
        }

        .action-badge {
            box-shadow: 0 0 0 2px $dark-header-bg;
        }
    }

    .bottom-nav {
        background-color: $dark-header-bg;
        border-top-color: $dark-border-color;

        .tab {
            color: #7d8590;

            &.is-active {
                color: $primary;
            }
        }

        .tab-badge {
            box-shadow: 0 0 0 2px $dark-header-bg;
        }
    }
}

.clear-all-toast-btn {
    position: fixed;
    right: 1em;
    bottom: 1em;
    font-size: 1.2em;
    padding: 9px 15px;
    width: 48px;
    box-shadow: 2px 2px 30px rgba(0, 0, 0, 0.2);
    z-index: 100;

    .dark & {
        box-shadow: 2px 2px 30px rgba(0, 0, 0, 0.5);
    }
}

@media (max-width: 767.98px) {
    .clear-all-toast-btn {
        bottom: calc(76px + env(safe-area-inset-bottom));
        right: 12px;
        width: 40px;
        height: 40px;
        padding: 0;
        font-size: 1em;
    }
}
</style>
