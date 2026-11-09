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
                v-if="$root.loggedIn && hasMonitors"
                to="/list"
                class="header-status"
                :class="$root.stats.down > 0 ? 'is-down' : 'is-up'"
            >
                <span class="dot" />
                <template v-if="$root.stats.down > 0">{{ $root.stats.down }} {{ $t("Down") }}</template>
                <template v-else>{{ $root.stats.up }} {{ $t("Up") }}</template>
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

        hasMonitors() {
            return Object.keys(this.$root.monitorList).length > 0;
        },

        /**
         * Tabs of the mobile bottom navigation
         * @returns {object[]} Tabs
         */
        mobileTabs() {
            return [
                { to: "/dashboard", icon: "tachometer-alt", label: this.$t("Home") },
                {
                    to: "/list",
                    icon: "list",
                    label: this.$t("List"),
                    badge: this.$root.stats.down > 0 ? this.$root.stats.down : null,
                },
                { to: "/add", icon: "plus", label: this.$t("Add") },
                { to: "/settings", icon: "cog", label: this.$t("Settings") },
            ];
        },

        /**
         * Which bottom tab a route belongs to. Monitor pages live under the
         * List tab, since that is where they are opened from on mobile.
         * @returns {string|null} Path of the active tab
         */
        activeTab() {
            const path = this.$route.path;
            if (path === "/dashboard") {
                return "/dashboard";
            }
            if (path === "/add") {
                return "/add";
            }
            if (path === "/list" || /^\/(dashboard|edit|clone)\/\d+/.test(path)) {
                return "/list";
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
            const path = this.$route.path;
            return this.$root.loggedIn && !["/dashboard", "/list", "/add", "/settings"].includes(path);
        },

        hasNewVersion() {
            if (this.$root.info.latestVersion && this.$root.info.version) {
                return compareVersions(this.$root.info.latestVersion, this.$root.info.version) >= 1;
            } else {
                return false;
            }
        },
    },

    watch: {},

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

    .header-status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: auto;
        padding: 6px 12px;
        border-radius: 50rem;
        font-size: 13px;
        font-weight: 600;
        white-space: nowrap;
        text-decoration: none;
        font-variant-numeric: tabular-nums;
        transition: transform 120ms $easing-out;

        &:active {
            transform: scale(0.96);
        }

        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
        }

        &.is-up {
            color: #177a3f;
            background-color: rgba($primary, 0.18);

            .dot {
                background-color: $primary;
            }
        }

        &.is-down {
            color: #b42330;
            background-color: rgba($danger, 0.12);

            .dot {
                background-color: $danger;
            }
        }
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

        .header-status {
            &.is-up {
                color: $primary !important;
                background-color: rgba($primary, 0.12);
            }

            &.is-down {
                color: #ff6b77 !important;
                background-color: rgba($danger, 0.2);
            }
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
