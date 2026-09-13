"use strict";

document.addEventListener("DOMContentLoaded", () => {
    /* =====================================================
       STORAGE KEYS
       ===================================================== */

    const USER_KEY = "actionsTeamUser";
    const MEMBERS_KEY = "actionsTeamMembers";
    const STATS_KEY = "actionsTeamStats";
    const HISTORY_KEY = "actionsTeamActionHistory";
    const SCHEDULE_KEY = "actionsTeamSchedule";
    const ANNOUNCEMENTS_KEY = "actionsTeamAnnouncements";

    const DAYS = [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday"
    ];

    let editingScheduleId = null;
    let selectedAttendees = new Set();
    let draggedScheduleId = null;

    /* =====================================================
       BASIC HELPERS
       ===================================================== */

    function uid() {
        return (
            Date.now().toString(36) +
            Math.random().toString(36).slice(2)
        );
    }

    function getJson(key, fallback) {
        try {
            const value = localStorage.getItem(key);

            if (!value) {
                return fallback;
            }

            const parsed = JSON.parse(value);

            return parsed ?? fallback;
        } catch (error) {
            console.error(`Could not read ${key}:`, error);
            return fallback;
        }
    }

    function setJson(key, value) {
        try {
            localStorage.setItem(
                key,
                JSON.stringify(value)
            );
        } catch (error) {
            console.error(`Could not save ${key}:`, error);
        }
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function formatDateTime(value) {
        if (!value) {
            return "";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function showToast(message) {
        const toast = document.getElementById("toast");

        if (!toast) {
            return;
        }

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(showToast.timer);

        showToast.timer = setTimeout(() => {
            toast.classList.remove("show");
        }, 2600);
    }

    function getUser() {
        return getJson(USER_KEY, null);
    }

    function getMembers() {
        return getJson(MEMBERS_KEY, []);
    }

    function getStats() {
        return getJson(STATS_KEY, {});
    }

    function getHistory() {
        return getJson(HISTORY_KEY, []);
    }

    function getSchedule() {
        return getJson(SCHEDULE_KEY, []);
    }

    function getAnnouncements() {
        return getJson(ANNOUNCEMENTS_KEY, []);
    }

    function getRank() {
        const user = getUser();

        return user ? user.rank : "";
    }

    function isLeader() {
        const rank = getRank();

        return (
            rank === "ADM" ||
            rank === "AUX"
        );
    }

    /* =====================================================
       DATA REPAIR
       ===================================================== */

    function repairData() {
        let members = getMembers();

        if (!Array.isArray(members)) {
            members = [];
        }

        members = members.filter(member =>
            member &&
            member.id &&
            member.name &&
            member.rank
        );

        setJson(MEMBERS_KEY, members);

        let schedule = getSchedule();

        if (!Array.isArray(schedule)) {
            schedule = [];
        }

        schedule = schedule.filter(item =>
            item &&
            item.id &&
            DAYS.includes(item.day) &&
            item.action &&
            item.time
        );

        setJson(SCHEDULE_KEY, schedule);

        let announcements = getAnnouncements();

        if (!Array.isArray(announcements)) {
            announcements = [];
        }

        setJson(
            ANNOUNCEMENTS_KEY,
            announcements
        );

        let history = getHistory();

        if (!Array.isArray(history)) {
            history = [];
        }

        setJson(
            HISTORY_KEY,
            history
        );

        let stats = getStats();

        if (
            !stats ||
            typeof stats !== "object" ||
            Array.isArray(stats)
        ) {
            stats = {};
        }

        setJson(
            STATS_KEY,
            stats
        );
    }

    function ensureCurrentUserMember() {
        const user = getUser();

        if (!user) {
            return;
        }

        const members = getMembers();

        const exists = members.some(
            member =>
                String(member.id) ===
                String(user.id)
        );

        if (!exists) {
            members.push({
                id: user.id,
                name: user.name,
                rank: user.rank,
                createdAt: new Date().toISOString()
            });

            setJson(
                MEMBERS_KEY,
                members
            );
        }
    }

    function ensureStatsForMembers() {
        const members = getMembers();
        const stats = getStats();

        members.forEach(member => {
            if (
                typeof stats[member.id] !==
                "number"
            ) {
                stats[member.id] = 0;
            }
        });

        setJson(
            STATS_KEY,
            stats
        );
    }

    /* =====================================================
       NAVIGATION
       ===================================================== */

    function showPage(pageId) {
        console.log("Opening page:", pageId);

        const pages =
            document.querySelectorAll(".page");

        pages.forEach(page => {
            page.classList.remove("active");

            /*
             * Explicitly hide every page.
             * This prevents CSS from accidentally leaving
             * the signup page visible.
             */
            page.style.display = "none";
        });

        const page =
            document.getElementById(pageId);

        if (!page) {
            console.error(
                `Page "${pageId}" was not found.`
            );

            return;
        }

        page.classList.add("active");

        /*
         * Explicitly show requested page.
         */
        page.style.display = "block";

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        switch (pageId) {
            case "dashboardPage":
                updateDashboard();
                break;

            case "membersPage":
                renderMembers();
                break;

            case "announcementsPage":
                renderAnnouncements();
                break;

            case "schedulePage":
                renderSchedule();
                break;

            case "logActionPage":
                renderAttendees();
                break;

            case "leaderboardPage":
                renderLeaderboard();
                break;
        }
    }

    /* =====================================================
       DASHBOARD
       ===================================================== */

    function updateDashboard() {
        const user = getUser();

        if (!user) {
            showPage("signupPage");
            return;
        }

        const dashboardUser =
            document.getElementById(
                "dashboardUser"
            );

        const rankBanner =
            document.getElementById(
                "rankBanner"
            );

        const cardName =
            document.getElementById(
                "cardName"
            );

        const cardId =
            document.getElementById(
                "cardId"
            );

        const cardRank =
            document.getElementById(
                "cardRank"
            );

        if (dashboardUser) {
            dashboardUser.textContent =
                `${user.rank}:⚡ | ${user.name}`;
        }

        if (rankBanner) {
            rankBanner.textContent =
                `${user.rank}:⚡ | ${user.name}`;
        }

        if (cardName) {
            cardName.textContent =
                user.name;
        }

        if (cardId) {
            cardId.textContent =
                `ID: ${user.id}`;
        }

        if (cardRank) {
            cardRank.textContent =
                user.rank;
        }
    }

    /* =====================================================
       MEMBERS
       ===================================================== */

    function renderMembers() {
        const container =
            document.getElementById(
                "membersList"
            );

        if (!container) {
            return;
        }

        const members = getMembers();
        const currentUser = getUser();

        if (!members.length) {
            container.innerHTML = `
                <div class="large-card empty-state">
                    No members have been added yet.
                </div>
            `;

            return;
        }

        container.innerHTML = members.map(
            member => {
                const isCurrent =
                    currentUser &&
                    String(member.id) ===
                    String(currentUser.id);

                return `
                    <div class="member-card member-row">

                        <div class="member-main">

                            <strong class="member-name">
                                ${escapeHtml(member.name)}
                            </strong>

                            <small class="member-id">
                                ID: ${escapeHtml(member.id)}
                            </small>

                        </div>

                        <span class="member-rank rank-badge">
                            ${escapeHtml(member.rank)}
                        </span>

                        ${
                            isCurrent
                                ? `
                                    <span class="current-account">
                                        YOU
                                    </span>
                                `
                                : `
                                    <button
                                        type="button"
                                        class="delete-button"
                                        data-delete-member="${escapeHtml(member.id)}"
                                    >
                                        Delete
                                    </button>
                                `
                        }

                    </div>
                `;
            }
        ).join("");

        container
            .querySelectorAll(
                "[data-delete-member]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        deleteMember(
                            button.dataset.deleteMember
                        );
                    }
                );
            });
    }

    function addMember(
        name,
        memberId,
        rank
    ) {
        const members = getMembers();

        const cleanName =
            String(name).trim();

        const cleanId =
            String(memberId).trim();

        if (!cleanName || !cleanId || !rank) {
            showToast(
                "Please complete all member fields."
            );

            return false;
        }

        const duplicate =
            members.some(
                member =>
                    String(member.id)
                        .toLowerCase() ===
                    cleanId.toLowerCase()
            );

        if (duplicate) {
            showToast(
                "A member with that ID already exists."
            );

            return false;
        }

        members.push({
            id: cleanId,
            name: cleanName,
            rank,
            createdAt:
                new Date().toISOString()
        });

        setJson(
            MEMBERS_KEY,
            members
        );

        const stats = getStats();

        if (
            typeof stats[cleanId] !==
            "number"
        ) {
            stats[cleanId] = 0;
        }

        setJson(
            STATS_KEY,
            stats
        );

        renderMembers();
        renderAttendees();
        renderLeaderboard();

        showToast(
            "Member added successfully."
        );

        return true;
    }

    function deleteMember(memberId) {
        const user = getUser();

        if (
            user &&
            String(user.id) ===
            String(memberId)
        ) {
            showToast(
                "You cannot delete the current account."
            );

            return;
        }

        const members = getMembers();

        const member =
            members.find(
                item =>
                    String(item.id) ===
                    String(memberId)
            );

        if (!member) {
            return;
        }

        const confirmed =
            window.confirm(
                `Delete ${member.name} from the team?`
            );

        if (!confirmed) {
            return;
        }

        setJson(
            MEMBERS_KEY,
            members.filter(
                item =>
                    String(item.id) !==
                    String(memberId)
            )
        );

        const stats = getStats();

        delete stats[memberId];

        setJson(
            STATS_KEY,
            stats
        );

        selectedAttendees.delete(
            String(memberId)
        );

        renderMembers();
        renderAttendees();
        renderLeaderboard();

        showToast(
            "Member deleted."
        );
    }

    /* =====================================================
       SCHEDULE
       ===================================================== */

    function renderSchedule() {
        const container =
            document.getElementById(
                "scheduleList"
            );

        if (!container) {
            return;
        }

        const schedule =
            getSchedule();

        container.innerHTML =
            DAYS.map(day => {
                const items =
                    schedule
                        .filter(
                            item =>
                                item.day === day
                        )
                        .sort(
                            (a, b) =>
                                a.time.localeCompare(
                                    b.time
                                )
                        );

                return `
                    <div
                        class="schedule-day day-card"
                        data-day="${day}"
                    >

                        <h3>${day}</h3>

                        <div
                            class="schedule-items"
                            data-drop-day="${day}"
                        >

                            ${
                                items.length
                                    ? items.map(
                                        item => `
                                            <div
                                                class="schedule-item"
                                                draggable="true"
                                                data-schedule-id="${item.id}"
                                            >

                                                <span class="schedule-time">
                                                    ${escapeHtml(item.time)}
                                                </span>

                                                <span class="schedule-name">
                                                    ${escapeHtml(item.action)}
                                                </span>

                                                <span class="schedule-actions">

                                                    <button
                                                        type="button"
                                                        data-edit-schedule="${item.id}"
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        type="button"
                                                        data-delete-schedule="${item.id}"
                                                    >
                                                        ×
                                                    </button>

                                                </span>

                                            </div>
                                        `
                                    ).join("")
                                    : `
                                        <div class="empty-state">
                                            No scheduled actions
                                        </div>
                                    `
                            }

                        </div>

                    </div>
                `;
            }).join("");

        container
            .querySelectorAll(
                "[data-edit-schedule]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        openScheduleModal(
                            button.dataset.editSchedule
                        );
                    }
                );
            });

        container
            .querySelectorAll(
                "[data-delete-schedule]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        deleteSchedule(
                            button.dataset.deleteSchedule
                        );
                    }
                );
            });

        container
            .querySelectorAll(
                ".schedule-item"
            )
            .forEach(item => {
                item.addEventListener(
                    "dragstart",
                    event => {
                        draggedScheduleId =
                            item.dataset.scheduleId;

                        if (event.dataTransfer) {
                            event.dataTransfer.effectAllowed =
                                "move";

                            event.dataTransfer.setData(
                                "text/plain",
                                draggedScheduleId
                            );
                        }
                    }
                );

                item.addEventListener(
                    "dragend",
                    () => {
                        draggedScheduleId = null;
                    }
                );
            });

        container
            .querySelectorAll(
                "[data-drop-day]"
            )
            .forEach(dropZone => {
                dropZone.addEventListener(
                    "dragover",
                    event => {
                        event.preventDefault();

                        dropZone.classList.add(
                            "drag-over"
                        );
                    }
                );

                dropZone.addEventListener(
                    "dragleave",
                    () => {
                        dropZone.classList.remove(
                            "drag-over"
                        );
                    }
                );

                dropZone.addEventListener(
                    "drop",
                    event => {
                        event.preventDefault();

                        dropZone.classList.remove(
                            "drag-over"
                        );

                        let id =
                            draggedScheduleId;

                        if (
                            !id &&
                            event.dataTransfer
                        ) {
                            id =
                                event.dataTransfer.getData(
                                    "text/plain"
                                );
                        }

                        if (!id) {
                            return;
                        }

                        moveSchedule(
                            id,
                            dropZone.dataset.dropDay
                        );
                    }
                );
            });
    }

    function openScheduleModal(
        scheduleId = null
    ) {
        const modal =
            document.getElementById(
                "scheduleModal"
            );

        const title =
            document.getElementById(
                "scheduleModalTitle"
            );

        const day =
            document.getElementById(
                "scheduleDay"
            );

        const action =
            document.getElementById(
                "scheduleAction"
            );

        const time =
            document.getElementById(
                "scheduleTime"
            );

        if (
            !modal ||
            !title ||
            !day ||
            !action ||
            !time
        ) {
            return;
        }

        editingScheduleId =
            scheduleId;

        if (scheduleId) {
            const schedule =
                getSchedule();

            const item =
                schedule.find(
                    entry =>
                        entry.id ===
                        scheduleId
                );

            if (!item) {
                return;
            }

            title.textContent =
                "Edit Schedule";

            day.value =
                item.day;

            action.value =
                item.action;

            time.value =
                item.time;
        } else {
            title.textContent =
                "Add Schedule";

            day.value =
                "Monday";

            action.value =
                "";

            time.value =
                "";
        }

        modal.classList.add("open");
    }

    function saveSchedule() {
        const dayInput =
            document.getElementById(
                "scheduleDay"
            );

        const actionInput =
            document.getElementById(
                "scheduleAction"
            );

        const timeInput =
            document.getElementById(
                "scheduleTime"
            );

        if (
            !dayInput ||
            !actionInput ||
            !timeInput
        ) {
            return;
        }

        const day =
            dayInput.value;

        const action =
            actionInput.value.trim();

        const time =
            timeInput.value;

        if (!action || !time) {
            showToast(
                "Please complete all schedule fields."
            );

            return;
        }

        const schedule =
            getSchedule();

        const wasEditing =
            Boolean(editingScheduleId);

        if (editingScheduleId) {
            const item =
                schedule.find(
                    entry =>
                        entry.id ===
                        editingScheduleId
                );

            if (item) {
                item.day =
                    day;

                item.action =
                    action;

                item.time =
                    time;
            }
        } else {
            schedule.push({
                id: uid(),
                day,
                action,
                time,
                createdAt:
                    new Date().toISOString()
            });
        }

        setJson(
            SCHEDULE_KEY,
            schedule
        );

        closeModal(
            "scheduleModal"
        );

        renderSchedule();

        showToast(
            wasEditing
                ? "Schedule updated."
                : "Schedule added."
        );

        editingScheduleId =
            null;
    }

    function deleteSchedule(
        scheduleId
    ) {
        const schedule =
            getSchedule();

        const item =
            schedule.find(
                entry =>
                    entry.id ===
                    scheduleId
            );

        if (!item) {
            return;
        }

        if (
            !window.confirm(
                `Delete "${item.action}"?`
            )
        ) {
            return;
        }

        setJson(
            SCHEDULE_KEY,
            schedule.filter(
                entry =>
                    entry.id !==
                    scheduleId
            )
        );

        renderSchedule();

        showToast(
            "Schedule deleted."
        );
    }

    function moveSchedule(
        scheduleId,
        newDay
    ) {
        const schedule =
            getSchedule();

        const item =
            schedule.find(
                entry =>
                    entry.id ===
                    scheduleId
            );

        if (
            !item ||
            !DAYS.includes(newDay)
        ) {
            return;
        }

        item.day =
            newDay;

        setJson(
            SCHEDULE_KEY,
            schedule
        );

        renderSchedule();

        showToast(
            `Moved to ${newDay}.`
        );
    }

    /* =====================================================
       ATTENDEES
       ===================================================== */

    function renderAttendees() {
        const container =
            document.getElementById(
                "attendeeList"
            );

        if (!container) {
            return;
        }

        const members =
            getMembers();

        const currentUser =
            getUser();

        if (
            currentUser &&
            members.some(
                member =>
                    String(member.id) ===
                    String(currentUser.id)
            )
        ) {
            selectedAttendees.add(
                String(currentUser.id)
            );
        }

        if (!members.length) {
            container.innerHTML = `
                <div class="empty-state">
                    No members available.
                </div>
            `;

            return;
        }

        container.innerHTML =
            members.map(member => {
                const checked =
                    selectedAttendees.has(
                        String(member.id)
                    );

                const canRemove =
                    isLeader() &&
                    currentUser &&
                    String(member.id) !==
                    String(currentUser.id);

                return `
                    <div class="attendee-row">

                        <input
                            type="checkbox"
                            data-attendee-check="${escapeHtml(member.id)}"
                            ${checked ? "checked" : ""}
                        >

                        <div class="attendee-info">

                            <strong>
                                ${escapeHtml(member.name)}
                            </strong>

                            <small>
                                ${escapeHtml(member.rank)}
                                · ID ${escapeHtml(member.id)}
                            </small>

                        </div>

                        ${
                            canRemove
                                ? `
                                    <button
                                        type="button"
                                        class="delete-button"
                                        data-remove-attendee="${escapeHtml(member.id)}"
                                    >
                                        Remove
                                    </button>
                                `
                                : ""
                        }

                    </div>
                `;
            }).join("");

        container
            .querySelectorAll(
                "[data-attendee-check]"
            )
            .forEach(check => {
                check.addEventListener(
                    "change",
                    () => {
                        const id =
                            String(
                                check.dataset
                                    .attendeeCheck
                            );

                        if (check.checked) {
                            selectedAttendees.add(
                                id
                            );
                        } else {
                            selectedAttendees.delete(
                                id
                            );
                        }
                    }
                );
            });

        container
            .querySelectorAll(
                "[data-remove-attendee]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        deleteMember(
                            button.dataset
                                .removeAttendee
                        );
                    }
                );
            });
    }

    function addAttendee() {
        const nameInput =
            document.getElementById(
                "newAttendeeName"
            );

        const idInput =
            document.getElementById(
                "newAttendeeId"
            );

        const rankInput =
            document.getElementById(
                "newAttendeeRank"
            );

        if (
            !nameInput ||
            !idInput ||
            !rankInput
        ) {
            return;
        }

        const name =
            nameInput.value.trim();

        const id =
            idInput.value.trim();

        const rank =
            rankInput.value;

        if (!name || !id || !rank) {
            showToast(
                "Please complete the member details."
            );

            return;
        }

        const added =
            addMember(
                name,
                id,
                rank
            );

        if (!added) {
            return;
        }

        selectedAttendees.add(
            String(id)
        );

        nameInput.value = "";
        idInput.value = "";

        renderAttendees();
    }

    /* =====================================================
       LOG ACTION
       ===================================================== */

    function logAction() {
        const actionNameInput =
            document.getElementById(
                "actionName"
            );

        const actionDateInput =
            document.getElementById(
                "actionDate"
            );

        if (
            !actionNameInput ||
            !actionDateInput
        ) {
            return;
        }

        const actionName =
            actionNameInput.value.trim();

        const actionDate =
            actionDateInput.value;

        if (!actionName || !actionDate) {
            showToast(
                "Please enter an action name and date."
            );

            return;
        }

        const currentUser =
            getUser();

        if (!currentUser) {
            showPage(
                "signupPage"
            );

            return;
        }

        if (!selectedAttendees.size) {
            showToast(
                "Select at least one attendee."
            );

            return;
        }

        const attendees =
            getMembers().filter(
                member =>
                    selectedAttendees.has(
                        String(member.id)
                    )
            );

        if (!attendees.length) {
            showToast(
                "No valid attendees selected."
            );

            return;
        }

        const loading =
            document.getElementById(
                "loadingPage"
            );

        if (!loading) {
            return;
        }

        document
            .querySelectorAll(".page")
            .forEach(page => {
                page.classList.remove(
                    "active"
                );

                page.style.display = "none";
            });

        loading.classList.add(
            "active"
        );

        loading.style.display = "block";

        setTimeout(() => {
            const stats =
                getStats();

            attendees.forEach(
                member => {
                    stats[member.id] =
                        typeof stats[
                            member.id
                        ] === "number"
                            ? stats[
                                member.id
                            ] + 1
                            : 1;
                }
            );

            setJson(
                STATS_KEY,
                stats
            );

            const history =
                getHistory();

            history.unshift({
                id: uid(),
                actionName,
                date: actionDate,

                loggedBy: {
                    id:
                        currentUser.id,
                    name:
                        currentUser.name,
                    rank:
                        currentUser.rank
                },

                attendees:
                    attendees.map(
                        member => ({
                            id:
                                member.id,
                            name:
                                member.name,
                            rank:
                                member.rank
                        })
                    ),

                createdAt:
                    new Date().toISOString()
            });

            setJson(
                HISTORY_KEY,
                history.slice(0, 100)
            );

            actionNameInput.value = "";
            actionDateInput.value = "";

            selectedAttendees =
                new Set();

            ensureStatsForMembers();

            renderLeaderboard();

            showPage(
                "dashboardPage"
            );

            showToast(
                "Action logged successfully."
            );
        }, 900);
    }

    /* =====================================================
       LEADERBOARD
       ===================================================== */

    function renderLeaderboard() {
        const podium =
            document.getElementById(
                "podium"
            );

        const list =
            document.getElementById(
                "leaderboardList"
            );

        const historyContainer =
            document.getElementById(
                "historyList"
            );

        if (
            !podium ||
            !list ||
            !historyContainer
        ) {
            return;
        }

        const members =
            getMembers();

        const stats =
            getStats();

        const ranked =
            [...members].sort(
                (a, b) => {
                    const scoreA =
                        Number(
                            stats[a.id]
                        ) || 0;

                    const scoreB =
                        Number(
                            stats[b.id]
                        ) || 0;

                    if (
                        scoreB !==
                        scoreA
                    ) {
                        return (
                            scoreB -
                            scoreA
                        );
                    }

                    return a.name.localeCompare(
                        b.name
                    );
                }
            );

        const topThree =
            ranked.slice(0, 3);

        if (!topThree.length) {
            podium.innerHTML = `
                <div class="large-card empty-state">
                    No leaderboard data yet.
                </div>
            `;
        } else {
            podium.innerHTML =
                topThree.map(
                    (member, index) => `
                        <div class="podium-card">

                            <div class="podium-position">
                                ${
                                    index === 0
                                        ? "1st"
                                        : index === 1
                                            ? "2nd"
                                            : "3rd"
                                }
                            </div>

                            <strong>
                                ${escapeHtml(member.name)}
                            </strong>

                            <small>
                                ${escapeHtml(member.rank)}
                                · ID ${escapeHtml(member.id)}
                            </small>

                            <div class="score podium-score">
                                ${Number(stats[member.id]) || 0}
                            </div>

                        </div>
                    `
                ).join("");
        }

        if (!ranked.length) {
            list.innerHTML = `
                <div class="large-card empty-state">
                    No members available.
                </div>
            `;
        } else {
            list.innerHTML =
                ranked.map(
                    (member, index) => `
                        <div class="leaderboard-row">

                            <strong>
                                #${index + 1}
                            </strong>

                            <div>
                                <strong>
                                    ${escapeHtml(member.name)}
                                </strong>

                                <small>
                                    ${escapeHtml(member.rank)}
                                    · ID ${escapeHtml(member.id)}
                                </small>
                            </div>

                            <span class="score">
                                ${Number(stats[member.id]) || 0}
                            </span>

                        </div>
                    `
                ).join("");
        }

        const history =
            getHistory();

        if (!history.length) {
            historyContainer.innerHTML = `
                <div class="large-card empty-state">
                    No actions have been logged yet.
                </div>
            `;

            return;
        }

        historyContainer.innerHTML =
            history
                .slice(0, 20)
                .map(
                    entry => `
                        <div class="history-row">

                            <div>
                                <strong>
                                    ${escapeHtml(entry.actionName)}
                                </strong>

                                <small>
                                    Logged by
                                    ${escapeHtml(entry.loggedBy.name)}
                                    (${escapeHtml(entry.loggedBy.rank)})
                                    ·
                                    ${entry.attendees.length}
                                    attendee${entry.attendees.length === 1 ? "" : "s"}
                                </small>
                            </div>

                            <span class="score">
                                ${escapeHtml(
                                    formatDate(entry.date)
                                )}
                            </span>

                        </div>
                    `
                )
                .join("");
    }

    /* =====================================================
       ANNOUNCEMENTS
       ===================================================== */

    function renderAnnouncements() {
        const container =
            document.getElementById(
                "announcementsList"
            );

        if (!container) {
            return;
        }

        const announcements =
            getAnnouncements();

        if (!announcements.length) {
            container.innerHTML = `
                <div class="large-card empty-state">
                    No announcements have been posted yet.
                </div>
            `;

            return;
        }

        const currentUser =
            getUser();

        container.innerHTML =
            announcements.map(
                announcement => {
                    const canDelete =
                        currentUser &&
                        (
                            currentUser.rank ===
                            "ADM" ||
                            (
                                currentUser.rank ===
                                "AUX" &&
                                String(
                                    currentUser.id
                                ) ===
                                String(
                                    announcement.authorId
                                )
                            )
                        );

                    return `
                        <article class="announcement-card">

                            <h3>
                                ${escapeHtml(
                                    announcement.title
                                )}
                            </h3>

                            <p>
                                ${escapeHtml(
                                    announcement.description
                                )}
                            </p>

                            <small>
                                Posted by
                                ${escapeHtml(
                                    announcement.authorRank
                                )}
                                ·
                                ${escapeHtml(
                                    announcement.authorName
                                )}
                                ·
                                ${escapeHtml(
                                    formatDateTime(
                                        announcement.createdAt
                                    )
                                )}
                            </small>

                            ${
                                canDelete
                                    ? `
                                        <div style="margin-top:15px;">
                                            <button
                                                type="button"
                                                class="delete-button"
                                                data-delete-announcement="${announcement.id}"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    `
                                    : ""
                            }

                        </article>
                    `;
                }
            ).join("");

        container
            .querySelectorAll(
                "[data-delete-announcement]"
            )
            .forEach(button => {
                button.addEventListener(
                    "click",
                    () => {
                        deleteAnnouncement(
                            button.dataset
                                .deleteAnnouncement
                        );
                    }
                );
            });
    }

    function postAnnouncement() {
        const titleInput =
            document.getElementById(
                "announcementTitle"
            );

        const descriptionInput =
            document.getElementById(
                "announcementDescription"
            );

        if (
            !titleInput ||
            !descriptionInput
        ) {
            return;
        }

        const title =
            titleInput.value.trim();

        const description =
            descriptionInput.value.trim();

        const user =
            getUser();

        if (
            !title ||
            !description ||
            !user
        ) {
            showToast(
                "Please complete the announcement."
            );

            return;
        }

        const announcements =
            getAnnouncements();

        announcements.unshift({
            id: uid(),
            title,
            description,
            authorId: user.id,
            authorName: user.name,
            authorRank: user.rank,
            createdAt:
                new Date().toISOString()
        });

        setJson(
            ANNOUNCEMENTS_KEY,
            announcements.slice(0, 100)
        );

        const form =
            document.getElementById(
                "announcementForm"
            );

        if (form) {
            form.reset();
        }

        closeModal(
            "announcementModal"
        );

        renderAnnouncements();

        showToast(
            "Announcement posted."
        );
    }

    function deleteAnnouncement(id) {
        const announcements =
            getAnnouncements();

        const announcement =
            announcements.find(
                item =>
                    item.id === id
            );

        if (!announcement) {
            return;
        }

        if (
            !window.confirm(
                "Delete this announcement?"
            )
        ) {
            return;
        }

        setJson(
            ANNOUNCEMENTS_KEY,
            announcements.filter(
                item =>
                    item.id !== id
            )
        );

        renderAnnouncements();

        showToast(
            "Announcement deleted."
        );
    }

    /* =====================================================
       MODALS
       ===================================================== */

    function openModal(id) {
        const modal =
            document.getElementById(id);

        if (modal) {
            modal.classList.add("open");
        }
    }

    function closeModal(id) {
        const modal =
            document.getElementById(id);

        if (modal) {
            modal.classList.remove("open");
        }
    }

    /* =====================================================
       SIGN UP
       ===================================================== */

    function handleSignup(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }

        console.log("SIGNUP SUBMITTED");

        const nameInput =
            document.getElementById(
                "userName"
            );

        const idInput =
            document.getElementById(
                "userId"
            );

        const rankInput =
            document.getElementById(
                "userRank"
            );

        if (
            !nameInput ||
            !idInput ||
            !rankInput
        ) {
            console.error(
                "Signup fields could not be found."
            );

            return;
        }

        const name =
            nameInput.value.trim();

        const id =
            idInput.value.trim();

        const rank =
            rankInput.value;

        if (!name) {
            showToast(
                "Please enter your name."
            );

            nameInput.focus();

            return;
        }

        if (!id) {
            showToast(
                "Please enter your ID."
            );

            idInput.focus();

            return;
        }

        if (!rank) {
            showToast(
                "Please select your rank."
            );

            rankInput.focus();

            return;
        }

        /*
         * Save the user FIRST.
         */
        const existingUser =
            getUser();

        const user = {
            name,
            id,
            rank,
            createdAt:
                existingUser &&
                existingUser.createdAt
                    ? existingUser.createdAt
                    : new Date().toISOString()
        };

        setJson(
            USER_KEY,
            user
        );

        /*
         * Verify that the account was actually saved.
         */
        const savedUser =
            getUser();

        if (!savedUser) {
            console.error(
                "User could not be saved to localStorage."
            );

            showToast(
                "Could not save account. Please try again."
            );

            return;
        }

        ensureCurrentUserMember();
        ensureStatsForMembers();

        /*
         * THIS IS THE IMPORTANT PART:
         * Explicitly switch from signup to dashboard.
         */
        showPage(
            "dashboardPage"
        );

        updateDashboard();

        /*
         * Remove focus from the signup form.
         */
        if (document.activeElement) {
            document.activeElement.blur();
        }

        showToast(
            "Welcome to Actions Team."
        );
    }

    /* =====================================================
       EVENT LISTENERS
       ===================================================== */

    const signupForm =
        document.getElementById(
            "signupForm"
        );

    if (signupForm) {

        /*
         * CLICKING "ENTER DASHBOARD"
         */
        signupForm.addEventListener(
            "submit",
            event => {

                event.preventDefault();

                /*
                 * Run browser validation.
                 */
                if (
                    !signupForm.checkValidity()
                ) {
                    signupForm.reportValidity();
                    return;
                }

                handleSignup(event);
            }
        );

        /*
         * PRESSING ENTER
         *
         * This is deliberately handled separately.
         */
        signupForm.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !== "Enter"
                ) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();

                /*
                 * Check required fields.
                 */
                if (
                    !signupForm.checkValidity()
                ) {
                    signupForm.reportValidity();
                    return;
                }

                handleSignup(event);
            }
        );

    } else {
        console.error(
            "signupForm was not found."
        );
    }

    /* =====================================================
       PAGE BUTTONS
       ===================================================== */

    document
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    showPage(
                        button.dataset.page
                    );
                }
            );
        });

    /* =====================================================
       CHANGE ACCOUNT
       ===================================================== */

    const changeAccountButton =
        document.getElementById(
            "changeAccountButton"
        );

    if (changeAccountButton) {
        changeAccountButton.addEventListener(
            "click",
            () => {
                if (
                    window.confirm(
                        "Change account? Your team data will remain saved."
                    )
                ) {
                    localStorage.removeItem(
                        USER_KEY
                    );

                    const signupForm =
                        document.getElementById(
                            "signupForm"
                        );

                    if (signupForm) {
                        signupForm.reset();
                    }

                    showPage(
                        "signupPage"
                    );
                }
            }
        );
    }

    /* =====================================================
       MEMBER MODAL
       ===================================================== */

    const addMemberButton =
        document.getElementById(
            "addMemberButton"
        );

    if (addMemberButton) {
        addMemberButton.addEventListener(
            "click",
            () => {
                openModal(
                    "memberModal"
                );
            }
        );
    }

    const memberForm =
        document.getElementById(
            "memberForm"
        );

    if (memberForm) {
        memberForm.addEventListener(
            "submit",
            event => {
                event.preventDefault();

                const nameInput =
                    document.getElementById(
                        "memberName"
                    );

                const idInput =
                    document.getElementById(
                        "memberId"
                    );

                const rankInput =
                    document.getElementById(
                        "memberRank"
                    );

                if (
                    !nameInput ||
                    !idInput ||
                    !rankInput
                ) {
                    return;
                }

                const name =
                    nameInput.value.trim();

                const id =
                    idInput.value.trim();

                const rank =
                    rankInput.value;

                if (
                    !name ||
                    !id ||
                    !rank
                ) {
                    showToast(
                        "Please complete all member fields."
                    );

                    return;
                }

                if (
                    addMember(
                        name,
                        id,
                        rank
                    )
                ) {
                    memberForm.reset();

                    closeModal(
                        "memberModal"
                    );
                }
            }
        );
    }

    /* =====================================================
       SCHEDULE
       ===================================================== */

    const addScheduleButton =
        document.getElementById(
            "addScheduleButton"
        );

    if (addScheduleButton) {
        addScheduleButton.addEventListener(
            "click",
            () => {
                openScheduleModal();
            }
        );
    }

    const scheduleForm =
        document.getElementById(
            "scheduleForm"
        );

    if (scheduleForm) {
        scheduleForm.addEventListener(
            "submit",
            event => {
                event.preventDefault();

                saveSchedule();
            }
        );
    }

    /* =====================================================
       ANNOUNCEMENTS
       ===================================================== */

    const postAnnouncementButton =
        document.getElementById(
            "postAnnouncementButton"
        );

    if (postAnnouncementButton) {
        postAnnouncementButton.addEventListener(
            "click",
            () => {
                openModal(
                    "announcementModal"
                );
            }
        );
    }

    const announcementForm =
        document.getElementById(
            "announcementForm"
        );

    if (announcementForm) {
        announcementForm.addEventListener(
            "submit",
            event => {
                event.preventDefault();

                postAnnouncement();
            }
        );
    }

    /* =====================================================
       ATTENDEES
       ===================================================== */

    const toggleAttendeeFormButton =
        document.getElementById(
            "toggleAttendeeFormButton"
        );

    if (toggleAttendeeFormButton) {
        toggleAttendeeFormButton.addEventListener(
            "click",
            () => {
                const form =
                    document.getElementById(
                        "attendeeForm"
                    );

                if (form) {
                    form.classList.toggle(
                        "hidden"
                    );
                }
            }
        );
    }

    const addAttendeeButton =
        document.getElementById(
            "addAttendeeButton"
        );

    if (addAttendeeButton) {
        addAttendeeButton.addEventListener(
            "click",
            addAttendee
        );
    }

    /* =====================================================
       LOG ACTION
       ===================================================== */

    const logActionButton =
        document.getElementById(
            "logActionButton"
        );

    if (logActionButton) {
        logActionButton.addEventListener(
            "click",
            logAction
        );
    }

    /* =====================================================
       MODAL CLOSE BUTTONS
       ===================================================== */

    document
        .querySelectorAll(
            "[data-close-modal]"
        )
        .forEach(button => {
            button.addEventListener(
                "click",
                () => {
                    closeModal(
                        button.dataset
                            .closeModal
                    );
                }
            );
        });

    document
        .querySelectorAll(".modal")
        .forEach(modal => {
            modal.addEventListener(
                "click",
                event => {
                    if (
                        event.target ===
                        modal
                    ) {
                        modal.classList.remove(
                            "open"
                        );
                    }
                }
            );
        });

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key ===
                "Escape"
            ) {
                document
                    .querySelectorAll(
                        ".modal.open"
                    )
                    .forEach(modal => {
                        modal.classList.remove(
                            "open"
                        );
                    });
            }
        }
    );

    /* =====================================================
       INITIALISE
       ===================================================== */

    function init() {
        console.log(
            "Actions Team JavaScript loaded."
        );

        repairData();

        const user =
            getUser();

        /*
         * No account yet:
         * show signup page.
         */
        if (!user) {
            showPage(
                "signupPage"
            );

            return;
        }

        /*
         * Existing account:
         * go directly to dashboard.
         */
        ensureCurrentUserMember();
        ensureStatsForMembers();

        const userName =
            document.getElementById(
                "userName"
            );

        const userId =
            document.getElementById(
                "userId"
            );

        const userRank =
            document.getElementById(
                "userRank"
            );

        if (userName) {
            userName.value =
                user.name;
        }

        if (userId) {
            userId.value =
                user.id;
        }

        if (userRank) {
            userRank.value =
                user.rank;
        }

        updateDashboard();

        renderMembers();
        renderSchedule();
        renderAnnouncements();
        renderAttendees();
        renderLeaderboard();

        showPage(
            "dashboardPage"
        );
    }

    /*
     * Start the application.
     */
    init();
});