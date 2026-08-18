"use strict"

import "./libs/dayjs.js"
import "./styles/global.css"
import "./styles/form.css"
import "./styles/schedule.css"

import dayjs from "dayjs"
import { supabase } from "./libs/supabase-client.js"
import { authFetch, requireCapability, can } from "./modules/session.js"

const selectedDate = document.getElementById("date")
const logoutButton = document.getElementById("logout")
const periodMorning = document.getElementById("period-morning")
const periodAfternoon = document.getElementById("period-afternoon")
const periodNight = document.getElementById("period-night")
const calendarGrid = document.getElementById("calendar-grid")
const calendarMonth = document.getElementById("calendar-month")
const prevMonthButton = document.getElementById("prev-month")
const nextMonthButton = document.getElementById("next-month")
const todayButton = document.getElementById("today-button")
const selectedDayTitle = document.getElementById("selected-day-title")
const selectedDayMeta = document.getElementById("selected-day-meta")
const dayCount = document.getElementById("day-count")
const monthCount = document.getElementById("month-count")
const dayRevenue = document.getElementById("day-revenue")
const adminTitle = document.getElementById("admin-title")
const adminSubtitle = document.getElementById("admin-subtitle")
// Todo botao que troca de view, esteja ele na barra de abas ou na barra
// superior (o caso do "Equipe", que fica ao lado de "Clientes").
const tabs = document.querySelectorAll("[data-view]")
const views = {
    agenda: document.getElementById("agenda-view"),
    services: document.getElementById("services-view"),
    barbers: document.getElementById("barbers-view"),
    availability: document.getElementById("availability-view"),
    team: document.getElementById("team-view"),
}
const teamForm = document.getElementById("team-form")
const teamFormTitle = document.getElementById("team-form-title")
const teamId = document.getElementById("team-id")
const teamName = document.getElementById("team-name")
const teamEmail = document.getElementById("team-email")
const teamPassword = document.getElementById("team-password")
const teamPasswordHint = document.getElementById("team-password-hint")
const teamRole = document.getElementById("team-role")
const teamCancel = document.getElementById("team-cancel")
const teamList = document.getElementById("team-list")
const serviceForm = document.getElementById("service-form")
const serviceFormTitle = document.getElementById("service-form-title")
const serviceId = document.getElementById("service-id")
const serviceName = document.getElementById("service-name")
const servicePrice = document.getElementById("service-price")
const serviceDuration = document.getElementById("service-duration")
const serviceActive = document.getElementById("service-active")
const serviceCancel = document.getElementById("service-cancel")
const servicesList = document.getElementById("services-list")
const barberForm = document.getElementById("barber-form")
const barberFormTitle = document.getElementById("barber-form-title")
const barberId = document.getElementById("barber-id")
const barberName = document.getElementById("barber-name")
const barberPhone = document.getElementById("barber-phone")
const barberActive = document.getElementById("barber-active")
const barberCancel = document.getElementById("barber-cancel")
const barbersList = document.getElementById("barbers-list")
const availabilityForm = document.getElementById("availability-form")
const availabilityDays = document.getElementById("availability-days")
const breakActive = document.getElementById("break-active")
const breakStart = document.getElementById("break-start")
const breakEnd = document.getElementById("break-end")
const blockForm = document.getElementById("block-form")
const blockDate = document.getElementById("block-date")
const blockStart = document.getElementById("block-start")
const blockEnd = document.getElementById("block-end")
const blockBarber = document.getElementById("block-barber")
const blockReason = document.getElementById("block-reason")
const blocksList = document.getElementById("blocks-list")

let currentMonth = dayjs().startOf("month")
let selectedDay = dayjs()
let monthSchedules = []
let loadRequestId = 0
let servicesLoaded = false
let barbersLoaded = false
let teamLoaded = false
let teamCache = []
let availabilityLoaded = false
let servicesCache = []
let barbersCache = []
let availabilityCache = null
const weekDays = [
    "Domingo",
    "Segunda",
    "Terca",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sabado",
]
const viewCopy = {
    agenda: {
        title: "Agenda da barbearia",
        subtitle: "Veja o mes inteiro e clique em um dia para gerenciar os horarios.",
    },
    services: {
        title: "Servicos",
        subtitle: "Cadastre precos e duracoes usados no agendamento do cliente.",
    },
    barbers: {
        title: "Barbeiros",
        subtitle: "Cadastre profissionais e controle quem aparece para o cliente.",
    },
    availability: {
        title: "Horarios",
        subtitle: "Configure expediente, almoco e bloqueios pontuais da agenda.",
    },
    team: {
        title: "Equipe",
        subtitle: "Contas com acesso ao painel: crie, edite, troque a senha ou remova.",
    },
}

function categoryLabel(category) {
    const labels = {
        avulso: "Avulso",
        cadastrado: "Cadastrado",
        assinante: "Assinante",
    }
    return labels[category] || "Avulso"
}

function formatDate(date) {
    return dayjs(date).format("YYYY-MM-DD")
}

function formatCurrency(cents) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(cents / 100)
}

function centsToInputValue(cents) {
    return (Number(cents || 0) / 100).toFixed(2)
}

function inputValueToCents(value) {
    return Math.round(Number(String(value).replace(",", ".")) * 100)
}

function isValidTime(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) return false
    const [hour, minute] = value.split(":").map(Number)
    return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

function formatLongDate(date) {
    return new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(dayjs(date).toDate())
}

function formatMonth(date) {
    return new Intl.DateTimeFormat("pt-BR", {
        month: "long",
        year: "numeric",
    }).format(dayjs(date).toDate())
}

// Sessão do usuário logado ({ email, role, capabilities }), preenchida por
// ensureAccess() antes de qualquer carregamento de dados.
let session = null

// Entra quem consegue ver a agenda: admin e o perfil "agendamento".
// As áreas restritas são escondidas em applyCapabilities().
async function ensureAccess() {
    session = await requireCapability("booking:read_all")
    if (!session) return false

    applyCapabilities()
    return true
}

// Esconde o que este papel não pode usar. É só UX: cada endpoint volta a
// checar a permissão no servidor.
function applyCapabilities() {
    // Abas que exigem uma capacidade para aparecer.
    const capabilityByTab = {
        services: "catalog:manage",
        barbers: "catalog:manage",
        team: "users:manage",
    }

    tabs.forEach((tab) => {
        const required = capabilityByTab[tab.dataset.view]
        tab.hidden = Boolean(required) && !can(session, required)
    })

    // Aba Horários: bloqueios pontuais ficam; expediente semanal é do admin.
    if (!can(session, "availability:hours_manage")) {
        availabilityForm.hidden = true
    }
}

async function loadMonth() {
    const requestId = ++loadRequestId
    const start = currentMonth.startOf("month").format("YYYY-MM-DD")
    const end = currentMonth.endOf("month").format("YYYY-MM-DD")

    setCalendarLoading(true)
    renderDayMessage("Carregando agendamentos...")

    try {
        const response = await authFetch(
            `/admin/appointments?start=${start}&end=${end}`
        )

        if (!response.ok) {
            const data = await response.json().catch(() => ({}))
            throw new Error(data.error || "Nao foi possivel carregar os agendamentos.")
        }

        const schedules = await response.json()
        if (requestId !== loadRequestId) return

        monthSchedules = schedules
        renderCalendar()
        renderSelectedDay()
    } catch (error) {
        if (requestId !== loadRequestId) return

        monthSchedules = []
        renderCalendar()
        renderDayMessage(error.message || "Nao foi possivel carregar os agendamentos.")
    } finally {
        if (requestId === loadRequestId) {
            setCalendarLoading(false)
        }
    }
}

function setCalendarLoading(loading) {
    prevMonthButton.disabled = loading
    nextMonthButton.disabled = loading
    todayButton.disabled = loading
}

function renderDayMessage(message) {
    periodMorning.innerHTML = ""
    periodAfternoon.innerHTML = ""
    periodNight.innerHTML = ""

    dayCount.textContent = "0"
    monthCount.textContent = "0"
    dayRevenue.textContent = formatCurrency(0)
    selectedDayTitle.textContent = formatLongDate(selectedDay)
    selectedDayMeta.textContent = selectedDay.isSame(dayjs(), "day")
        ? "Hoje"
        : selectedDay.format("DD/MM/YYYY")

    const li = document.createElement("li")
    li.classList.add("empty")
    li.textContent = message
    periodMorning.appendChild(li)
    fillEmptyPeriods()
}

function schedulesByDate() {
    return monthSchedules.reduce((acc, schedule) => {
        const date = formatDate(schedule.when)
        acc[date] = acc[date] || []
        acc[date].push(schedule)
        return acc
    }, {})
}

function renderCalendar() {
    calendarGrid.innerHTML = ""
    calendarMonth.textContent = formatMonth(currentMonth)

    const counts = schedulesByDate()
    const firstCell = currentMonth
        .startOf("month")
        .subtract(currentMonth.startOf("month").day(), "day")

    for (let index = 0; index < 42; index++) {
        const date = firstCell.add(index, "day")
        const dateValue = formatDate(date)
        const count = counts[dateValue]?.length || 0

        const button = document.createElement("button")
        button.type = "button"
        button.classList.add("calendar-day")
        button.dataset.date = dateValue
        button.setAttribute("aria-label", formatLongDate(date))

        if (!date.isSame(currentMonth, "month")) {
            button.classList.add("calendar-day-muted")
        }
        if (date.isSame(dayjs(), "day")) {
            button.classList.add("calendar-day-today")
        }
        if (date.isSame(selectedDay, "day")) {
            button.classList.add("calendar-day-selected")
        }

        const number = document.createElement("span")
        number.classList.add("calendar-number")
        number.textContent = date.format("D")

        const indicator = document.createElement("span")
        indicator.classList.add(count ? "calendar-count" : "calendar-empty-count")
        indicator.textContent = count ? String(count) : ""

        button.append(number, indicator)
        button.addEventListener("click", () => selectDay(date))
        calendarGrid.appendChild(button)
    }
}

async function selectDay(date) {
    selectedDay = dayjs(date)
    selectedDate.value = selectedDay.format("YYYY-MM-DD")

    if (!selectedDay.isSame(currentMonth, "month")) {
        currentMonth = selectedDay.startOf("month")
        await loadMonth()
        return
    }

    renderCalendar()
    renderSelectedDay()
}

function renderSelectedDay() {
    const selectedValue = selectedDay.format("YYYY-MM-DD")
    const schedules = monthSchedules
        .filter((schedule) => formatDate(schedule.when) === selectedValue)
        .sort((a, b) => dayjs(a.when) - dayjs(b.when))

    selectedDayTitle.textContent = formatLongDate(selectedDay)
    selectedDayMeta.textContent = selectedDay.isSame(dayjs(), "day")
        ? "Hoje"
        : selectedDay.format("DD/MM/YYYY")

    renderSchedules(schedules)
}

function renderSchedules(schedules) {
    periodMorning.innerHTML = ""
    periodAfternoon.innerHTML = ""
    periodNight.innerHTML = ""

    dayCount.textContent = String(schedules.length)
    monthCount.textContent = String(monthSchedules.length)
    dayRevenue.textContent = formatCurrency(
        schedules.reduce(
            (total, schedule) => total + Number(schedule.servicePriceCents || 0),
            0
        )
    )

    schedules.forEach((schedule) => {
        const item = document.createElement("li")
        item.setAttribute("data-id", schedule.id)

        const time = document.createElement("strong")
        time.textContent = dayjs(schedule.when).format("HH:mm")

        const name = document.createElement("span")
        name.classList.add("item-name")
        name.textContent = schedule.name

        const details = document.createElement("small")
        details.classList.add("item-details")
        details.textContent = [schedule.serviceName, schedule.barberName]
            .filter(Boolean)
            .join(" - ")

        const badge = document.createElement("span")
        badge.classList.add("badge", `badge-${schedule.category}`)
        badge.textContent = categoryLabel(schedule.category)

        const actions = document.createElement("div")
        actions.classList.add("item-actions")

        const rescheduleBtn = document.createElement("button")
        rescheduleBtn.type = "button"
        rescheduleBtn.textContent = "Remarcar"
        rescheduleBtn.addEventListener("click", () =>
            rescheduleAppointment(schedule)
        )

        const cancelBtn = document.createElement("button")
        cancelBtn.type = "button"
        cancelBtn.textContent = "Cancelar"
        cancelBtn.addEventListener("click", () => cancelAppointment(schedule))

        actions.append(rescheduleBtn, cancelBtn)
        item.append(time, name)

        if (details.textContent) {
            item.append(details)
        }

        item.append(badge, actions)

        const hour = dayjs(schedule.when).hour()
        if (hour <= 12) {
            periodMorning.appendChild(item)
        } else if (hour > 12 && hour <= 18) {
            periodAfternoon.appendChild(item)
        } else {
            periodNight.appendChild(item)
        }
    })

    fillEmptyPeriods()
}

function switchView(name) {
    adminTitle.textContent = viewCopy[name].title
    adminSubtitle.textContent = viewCopy[name].subtitle
    todayButton.hidden = name !== "agenda"

    tabs.forEach((tab) => {
        const active = tab.dataset.view === name
        tab.classList.toggle("admin-tab-active", active)
        tab.setAttribute("aria-selected", String(active))
    })

    Object.entries(views).forEach(([viewName, element]) => {
        element.hidden = viewName !== name
    })

    if (name === "services" && !servicesLoaded) {
        loadServices()
    }
    if (name === "barbers" && !barbersLoaded) {
        loadBarbers()
    }
    if (name === "team" && !teamLoaded) {
        loadTeam()
    }
    if (name === "availability" && !availabilityLoaded) {
        loadAvailability()
    }
}

function setSubmitLoading(form, loading) {
    const button = form.querySelector("button[type='submit']")
    button.disabled = loading
}

async function loadServices() {
    servicesList.innerHTML = "<li class='empty'>Carregando servicos...</li>"

    try {
        const response = await authFetch("/admin/services")
        if (!response.ok) {
            servicesList.innerHTML =
                "<li class='empty'>Nao foi possivel carregar os servicos. Verifique se o schema foi aplicado.</li>"
            return
        }

        servicesLoaded = true
        servicesCache = await response.json()
        renderServices()
    } catch (error) {
        console.log(error)
        servicesList.innerHTML =
            "<li class='empty'>Nao foi possivel carregar os servicos.</li>"
    }
}

function renderServices() {
    servicesList.innerHTML = ""

    if (servicesCache.length === 0) {
        servicesList.innerHTML = "<li class='empty'>Nenhum servico cadastrado.</li>"
        return
    }

    servicesCache.forEach((service) => {
        const item = document.createElement("li")
        item.classList.add("management-item")

        const info = document.createElement("div")
        info.classList.add("management-info")

        const name = document.createElement("strong")
        name.textContent = service.name

        const meta = document.createElement("span")
        meta.textContent = `${formatCurrency(service.priceCents)} - ${service.durationMinutes} min`

        info.append(name, meta)

        const status = document.createElement("span")
        status.classList.add(
            "status-badge",
            service.active ? "status-active" : "status-inactive"
        )
        status.textContent = service.active ? "Ativo" : "Inativo"

        const actions = document.createElement("div")
        actions.classList.add("item-actions")

        const editButton = document.createElement("button")
        editButton.type = "button"
        editButton.textContent = "Editar"
        editButton.addEventListener("click", () => editService(service))

        const toggleButton = document.createElement("button")
        toggleButton.type = "button"
        toggleButton.textContent = service.active ? "Desativar" : "Ativar"
        toggleButton.addEventListener("click", () =>
            toggleService(service, !service.active)
        )

        actions.append(editButton, toggleButton)
        item.append(info, status, actions)
        servicesList.appendChild(item)
    })
}

function editService(service) {
    serviceFormTitle.textContent = "Editar servico"
    serviceId.value = service.id
    serviceName.value = service.name
    servicePrice.value = centsToInputValue(service.priceCents)
    serviceDuration.value = service.durationMinutes
    serviceActive.checked = service.active
    serviceName.focus()
}

function resetServiceForm() {
    serviceFormTitle.textContent = "Novo servico"
    serviceForm.reset()
    serviceId.value = ""
    serviceActive.checked = true
}

async function saveService(event) {
    event.preventDefault()

    const priceCents = inputValueToCents(servicePrice.value)
    const durationMinutes = Number(serviceDuration.value)

    if (!Number.isInteger(priceCents) || priceCents < 0) {
        return alert("Informe um preco valido.")
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
        return alert("Informe uma duracao valida.")
    }

    const payload = {
        name: serviceName.value.trim(),
        priceCents,
        durationMinutes,
        active: serviceActive.checked,
    }
    const editing = Boolean(serviceId.value)

    let response
    try {
        setSubmitLoading(serviceForm, true)
        response = await authFetch(
            editing ? `/admin/services/${serviceId.value}` : "/admin/services",
            {
                method: editing ? "PATCH" : "POST",
                body: JSON.stringify(payload),
            }
        )
    } catch (error) {
        console.log(error)
        alert("Nao foi possivel salvar o servico.")
        return
    } finally {
        setSubmitLoading(serviceForm, false)
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel salvar o servico.")
    }

    resetServiceForm()
    await loadServices()
}

async function toggleService(service, active) {
    let response
    try {
        response = await authFetch(`/admin/services/${service.id}`, {
            method: "PATCH",
            body: JSON.stringify({ active }),
        })
    } catch (error) {
        console.log(error)
        return alert("Nao foi possivel atualizar o servico.")
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel atualizar o servico.")
    }

    await loadServices()
}

async function loadBarbers() {
    barbersList.innerHTML = "<li class='empty'>Carregando barbeiros...</li>"

    try {
        const response = await authFetch("/admin/barbers")
        if (!response.ok) {
            barbersList.innerHTML =
                "<li class='empty'>Nao foi possivel carregar os barbeiros. Verifique se o schema foi aplicado.</li>"
            return
        }

        barbersLoaded = true
        barbersCache = await response.json()
        renderBarbers()
    } catch (error) {
        console.log(error)
        barbersList.innerHTML =
            "<li class='empty'>Nao foi possivel carregar os barbeiros.</li>"
    }
}

// ===== Equipe (contas com acesso ao painel) =====

const TEAM_ROLE_LABELS = { admin: "Admin", scheduler: "Agendamento" }

async function loadTeam() {
    teamList.innerHTML = "<li class='empty'>Carregando contas...</li>"

    try {
        const response = await authFetch("/admin/users")
        if (!response.ok) {
            teamList.innerHTML =
                "<li class='empty'>Nao foi possivel carregar as contas.</li>"
            return
        }

        teamLoaded = true
        teamCache = await response.json()
        renderTeam()
    } catch (error) {
        console.log(error)
        teamList.innerHTML = "<li class='empty'>Nao foi possivel carregar as contas.</li>"
    }
}

function renderTeam() {
    teamList.innerHTML = ""

    if (teamCache.length === 0) {
        teamList.innerHTML = "<li class='empty'>Nenhuma conta com acesso ao painel.</li>"
        return
    }

    teamCache.forEach((member) => {
        const item = document.createElement("li")
        item.classList.add("management-item")

        const info = document.createElement("div")
        info.classList.add("management-info")
        const name = document.createElement("strong")
        name.textContent = member.name || "(sem nome)"
        const email = document.createElement("span")
        email.textContent = member.email
        info.append(name, email)

        const badge = document.createElement("span")
        badge.classList.add("role-badge", `role-${member.role}`)
        badge.textContent = TEAM_ROLE_LABELS[member.role] || member.role

        const actions = document.createElement("div")
        actions.classList.add("form-actions")

        const editButton = document.createElement("button")
        editButton.type = "button"
        editButton.classList.add("admin-action")
        editButton.textContent = "Editar"
        editButton.addEventListener("click", () => editTeamMember(member))

        actions.append(editButton)

        // Conta do ADMIN_EMAILS e a propria conta nao podem ser excluidas —
        // a API tambem recusa; aqui so evitamos oferecer a acao.
        if (!member.locked && member.email !== session.email) {
            const removeButton = document.createElement("button")
            removeButton.type = "button"
            removeButton.classList.add("admin-action")
            removeButton.textContent = "Excluir"
            removeButton.addEventListener("click", () => removeTeamMember(member))
            actions.append(removeButton)
        }

        item.append(info, badge, actions)
        teamList.appendChild(item)
    })
}

// Passa o formulario para o modo edicao: e-mail fica travado (e a chave que
// liga a conta ao cliente e ao perfil) e a senha vira opcional.
function editTeamMember(member) {
    teamFormTitle.textContent = "Editar conta"
    teamId.value = member.id
    teamName.value = member.name
    teamEmail.value = member.email
    teamEmail.disabled = true
    teamPassword.value = ""
    teamPasswordHint.textContent =
        "Deixe em branco para manter a senha atual, ou digite uma nova."
    teamRole.value = member.role
    teamRole.disabled = member.locked || member.email === session.email
    teamCancel.hidden = false
}

function resetTeamForm() {
    teamFormTitle.textContent = "Nova conta"
    teamForm.reset()
    teamId.value = ""
    teamEmail.disabled = false
    teamRole.disabled = false
    teamPasswordHint.textContent =
        "Informe a senha ao funcionario. Ela vale imediatamente."
    teamCancel.hidden = true
}

async function saveTeamMember(event) {
    event.preventDefault()

    const editingId = teamId.value
    const password = teamPassword.value

    const payload = editingId
        ? { name: teamName.value.trim(), role: teamRole.value }
        : {
              name: teamName.value.trim(),
              email: teamEmail.value.trim(),
              password,
              role: teamRole.value,
          }

    // Na edicao a senha so vai junto quando o admin digitou uma nova.
    if (editingId && password) payload.password = password

    const response = await authFetch(
        editingId ? `/admin/users/${editingId}` : "/admin/users",
        {
            method: editingId ? "PATCH" : "POST",
            body: JSON.stringify(payload),
        }
    )

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        alert(data.error || "Nao foi possivel salvar a conta.")
        return
    }

    resetTeamForm()
    await loadTeam()
}

async function removeTeamMember(member) {
    const confirmed = confirm(
        `Excluir a conta de ${member.name || member.email}?\n\n` +
            "A pessoa perde o acesso ao sistema. O historico de agendamentos dela e mantido."
    )
    if (!confirmed) return

    const response = await authFetch(`/admin/users/${member.id}`, { method: "DELETE" })

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        alert(data.error || "Nao foi possivel excluir a conta.")
        return
    }

    await loadTeam()
}

async function loadAvailability() {
    availabilityDays.innerHTML = "<p class='empty'>Carregando horarios...</p>"
    blocksList.innerHTML = "<li class='empty'>Carregando bloqueios...</li>"

    try {
        if (!barbersLoaded) {
            await loadBarbers()
        }

        const response = await authFetch("/admin/availability")
        if (!response.ok) {
            availabilityDays.innerHTML =
                "<p class='empty'>Nao foi possivel carregar os horarios. Verifique se o schema foi aplicado.</p>"
            blocksList.innerHTML = "<li class='empty'>Sem dados.</li>"
            return
        }

        availabilityLoaded = true
        availabilityCache = await response.json()
        renderAvailability()
    } catch (error) {
        console.log(error)
        availabilityDays.innerHTML =
            "<p class='empty'>Nao foi possivel carregar os horarios.</p>"
        blocksList.innerHTML = "<li class='empty'>Nao foi possivel carregar.</li>"
    }
}

function defaultHours() {
    return weekDays.map((_, dayOfWeek) => ({
        dayOfWeek,
        opensAt: dayOfWeek === 0 ? "09:00" : "09:00",
        closesAt: dayOfWeek === 0 ? "12:00" : dayOfWeek === 6 ? "14:00" : "18:00",
        slotIntervalMinutes: 60,
        active: dayOfWeek !== 0,
    }))
}

function renderAvailability() {
    const hours = availabilityCache?.hours?.length
        ? availabilityCache.hours
        : defaultHours()

    renderAvailabilityDays(hours)
    renderBreaks(availabilityCache?.breaks || [])
    renderBlockBarberOptions()
    renderBlocks(availabilityCache?.blocks || [])
}

function renderAvailabilityDays(hours) {
    availabilityDays.innerHTML = ""

    weekDays.forEach((label, dayOfWeek) => {
        const hour = hours.find((item) => item.dayOfWeek === dayOfWeek) ||
            defaultHours()[dayOfWeek]

        const card = document.createElement("div")
        card.classList.add("availability-day")
        card.dataset.day = String(dayOfWeek)

        const head = document.createElement("div")
        head.classList.add("availability-day-head")

        const strong = document.createElement("strong")
        strong.textContent = label

        const activeLabel = document.createElement("label")
        activeLabel.classList.add("admin-checkbox")
        activeLabel.style.marginBottom = "0"

        const activeInput = document.createElement("input")
        activeInput.type = "checkbox"
        activeInput.classList.add("availability-active")
        activeInput.checked = hour.active

        activeLabel.append(activeInput, document.createTextNode("Aberto"))
        head.append(strong, activeLabel)

        const fields = document.createElement("div")
        fields.classList.add("availability-day-fields")

        fields.append(
            timeField("Abre", "availability-open", hour.opensAt),
            timeField("Fecha", "availability-close", hour.closesAt),
            numberField("Intervalo", "availability-interval", hour.slotIntervalMinutes)
        )

        card.append(head, fields)
        availabilityDays.appendChild(card)
    })
}

function timeField(label, className, value) {
    const wrap = document.createElement("div")
    wrap.classList.add("admin-field")

    const labelEl = document.createElement("label")
    labelEl.textContent = label

    const input = document.createElement("input")
    input.type = "time"
    input.classList.add(className)
    input.value = value

    wrap.append(labelEl, input)
    return wrap
}

function numberField(label, className, value) {
    const wrap = document.createElement("div")
    wrap.classList.add("admin-field")

    const labelEl = document.createElement("label")
    labelEl.textContent = label

    const input = document.createElement("input")
    input.type = "number"
    input.min = "15"
    input.step = "15"
    input.classList.add(className)
    input.value = value

    wrap.append(labelEl, input)
    return wrap
}

function renderBreaks(breaks) {
    const mondayBreak = breaks.find((item) => item.dayOfWeek >= 1 && item.dayOfWeek <= 5)

    breakActive.checked = Boolean(mondayBreak)
    breakStart.value = mondayBreak?.startsAt || "12:00"
    breakEnd.value = mondayBreak?.endsAt || "13:00"
}

function renderBlockBarberOptions() {
    blockBarber.innerHTML = ""

    const allOption = document.createElement("option")
    allOption.value = ""
    allOption.textContent = "Toda a barbearia"
    blockBarber.appendChild(allOption)

    barbersCache
        .filter((barber) => barber.active)
        .forEach((barber) => {
            const option = document.createElement("option")
            option.value = barber.id
            option.textContent = barber.name
            blockBarber.appendChild(option)
        })
}

function renderBlocks(blocks) {
    blocksList.innerHTML = ""
    const activeBlocks = blocks.filter((block) => block.active)

    if (activeBlocks.length === 0) {
        blocksList.innerHTML = "<li class='empty'>Nenhum bloqueio futuro.</li>"
        return
    }

    activeBlocks.forEach((block) => {
        const item = document.createElement("li")
        item.classList.add("management-item")

        const info = document.createElement("div")
        info.classList.add("management-info")

        const title = document.createElement("strong")
        title.textContent = `${dayjs(block.date).format("DD/MM/YYYY")} - ${block.startsAt} as ${block.endsAt}`

        const barber = barbersCache.find((item) => item.id === block.barberId)
        const meta = document.createElement("span")
        meta.textContent = [
            barber ? barber.name : "Toda a barbearia",
            block.reason || "",
        ]
            .filter(Boolean)
            .join(" - ")

        info.append(title, meta)

        const actions = document.createElement("div")
        actions.classList.add("item-actions")

        const deactivateButton = document.createElement("button")
        deactivateButton.type = "button"
        deactivateButton.textContent = "Remover"
        deactivateButton.addEventListener("click", () => deactivateBlock(block))

        actions.append(deactivateButton)
        item.append(info, actions)
        blocksList.appendChild(item)
    })
}

async function saveAvailability(event) {
    event.preventDefault()

    const hours = [...document.querySelectorAll(".availability-day")].map((card) => ({
        dayOfWeek: Number(card.dataset.day),
        active: card.querySelector(".availability-active").checked,
        opensAt: card.querySelector(".availability-open").value,
        closesAt: card.querySelector(".availability-close").value,
        slotIntervalMinutes: Number(card.querySelector(".availability-interval").value),
    }))

    const breaks = breakActive.checked
        ? [1, 2, 3, 4, 5].map((dayOfWeek) => ({
              dayOfWeek,
              startsAt: breakStart.value,
              endsAt: breakEnd.value,
              active: true,
          }))
        : []

    let response
    try {
        setSubmitLoading(availabilityForm, true)
        response = await authFetch("/admin/availability", {
            method: "PUT",
            body: JSON.stringify({ hours, breaks }),
        })
    } catch (error) {
        console.log(error)
        alert("Nao foi possivel salvar os horarios.")
        return
    } finally {
        setSubmitLoading(availabilityForm, false)
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel salvar os horarios.")
    }

    availabilityCache = await response.json()
    renderAvailability()
    alert("Horarios salvos.")
}

async function saveBlock(event) {
    event.preventDefault()

    let response
    try {
        setSubmitLoading(blockForm, true)
        response = await authFetch("/admin/availability", {
            method: "POST",
            body: JSON.stringify({
                date: blockDate.value,
                startsAt: blockStart.value,
                endsAt: blockEnd.value,
                barberId: blockBarber.value || null,
                reason: blockReason.value.trim(),
            }),
        })
    } catch (error) {
        console.log(error)
        alert("Nao foi possivel criar o bloqueio.")
        return
    } finally {
        setSubmitLoading(blockForm, false)
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel criar o bloqueio.")
    }

    blockForm.reset()
    blockDate.value = dayjs().format("YYYY-MM-DD")
    availabilityLoaded = false
    await loadAvailability()
}

async function deactivateBlock(block) {
    let response
    try {
        response = await authFetch(`/admin/availability/${block.id}`, {
            method: "PATCH",
        })
    } catch (error) {
        console.log(error)
        return alert("Nao foi possivel remover o bloqueio.")
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel remover o bloqueio.")
    }

    availabilityLoaded = false
    await loadAvailability()
}

function renderBarbers() {
    barbersList.innerHTML = ""

    if (barbersCache.length === 0) {
        barbersList.innerHTML = "<li class='empty'>Nenhum barbeiro cadastrado.</li>"
        return
    }

    barbersCache.forEach((barber) => {
        const item = document.createElement("li")
        item.classList.add("management-item")

        const info = document.createElement("div")
        info.classList.add("management-info")

        const name = document.createElement("strong")
        name.textContent = barber.name

        const meta = document.createElement("span")
        meta.textContent = barber.phone || "Sem telefone cadastrado"

        info.append(name, meta)

        const status = document.createElement("span")
        status.classList.add(
            "status-badge",
            barber.active ? "status-active" : "status-inactive"
        )
        status.textContent = barber.active ? "Ativo" : "Inativo"

        const actions = document.createElement("div")
        actions.classList.add("item-actions")

        const editButton = document.createElement("button")
        editButton.type = "button"
        editButton.textContent = "Editar"
        editButton.addEventListener("click", () => editBarber(barber))

        const toggleButton = document.createElement("button")
        toggleButton.type = "button"
        toggleButton.textContent = barber.active ? "Desativar" : "Ativar"
        toggleButton.addEventListener("click", () =>
            toggleBarber(barber, !barber.active)
        )

        actions.append(editButton, toggleButton)
        item.append(info, status, actions)
        barbersList.appendChild(item)
    })
}

function editBarber(barber) {
    barberFormTitle.textContent = "Editar barbeiro"
    barberId.value = barber.id
    barberName.value = barber.name
    barberPhone.value = barber.phone || ""
    barberActive.checked = barber.active
    barberName.focus()
}

function resetBarberForm() {
    barberFormTitle.textContent = "Novo barbeiro"
    barberForm.reset()
    barberId.value = ""
    barberActive.checked = true
}

function invalidateAvailabilityBarbers() {
    availabilityLoaded = false
    if (availabilityCache) {
        renderBlockBarberOptions()
    }
}

async function saveBarber(event) {
    event.preventDefault()

    const payload = {
        name: barberName.value.trim(),
        phone: barberPhone.value.trim(),
        active: barberActive.checked,
    }
    const editing = Boolean(barberId.value)

    let response
    try {
        setSubmitLoading(barberForm, true)
        response = await authFetch(
            editing ? `/admin/barbers/${barberId.value}` : "/admin/barbers",
            {
                method: editing ? "PATCH" : "POST",
                body: JSON.stringify(payload),
            }
        )
    } catch (error) {
        console.log(error)
        alert("Nao foi possivel salvar o barbeiro.")
        return
    } finally {
        setSubmitLoading(barberForm, false)
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel salvar o barbeiro.")
    }

    resetBarberForm()
    await loadBarbers()
    invalidateAvailabilityBarbers()
}

async function toggleBarber(barber, active) {
    let response
    try {
        response = await authFetch(`/admin/barbers/${barber.id}`, {
            method: "PATCH",
            body: JSON.stringify({ active }),
        })
    } catch (error) {
        console.log(error)
        return alert("Nao foi possivel atualizar o barbeiro.")
    }

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel atualizar o barbeiro.")
    }

    await loadBarbers()
    invalidateAvailabilityBarbers()
}

function fillEmptyPeriods() {
    ;[periodMorning, periodAfternoon, periodNight].forEach((ul) => {
        if (ul.children.length === 0) {
            const li = document.createElement("li")
            li.classList.add("empty")
            li.textContent = "Sem agendamentos."
            ul.appendChild(li)
        }
    })
}

async function cancelAppointment(schedule) {
    const ok = confirm(
        `Cancelar o agendamento de ${schedule.name} as ${dayjs(
            schedule.when
        ).format("HH:mm")}?`
    )
    if (!ok) return

    const response = await authFetch(`/appointments/${schedule.id}`, {
        method: "DELETE",
    })

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel cancelar.")
    }

    alert("Agendamento cancelado.")
    await loadMonth()
}

async function rescheduleAppointment(schedule) {
    const current = dayjs(schedule.when).format("HH:mm")
    const input = prompt(
        `Novo horario para ${schedule.name} (formato HH:mm).`,
        current
    )
    if (!input) return

    const value = input.trim()
    if (!isValidTime(value)) {
        return alert("Horario invalido. Use o formato HH:mm.")
    }

    const [hour, minute] = value.split(":").map(Number)
    const when = dayjs(schedule.when)
        .startOf("day")
        .add(hour, "hour")
        .add(minute, "minute")
        .toISOString()

    const response = await authFetch(`/appointments/${schedule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ when }),
    })

    if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        return alert(data.error || "Nao foi possivel remarcar.")
    }

    alert("Agendamento remarcado.")
    selectedDay = dayjs(when)
    currentMonth = selectedDay.startOf("month")
    await loadMonth()
}

logoutButton.addEventListener("click", async () => {
    await supabase.auth.signOut()
    window.location.href = "login.html"
})

prevMonthButton.addEventListener("click", async () => {
    currentMonth = currentMonth.subtract(1, "month")
    selectedDay = currentMonth.startOf("month")
    selectedDate.value = selectedDay.format("YYYY-MM-DD")
    await loadMonth()
})

nextMonthButton.addEventListener("click", async () => {
    currentMonth = currentMonth.add(1, "month")
    selectedDay = currentMonth.startOf("month")
    selectedDate.value = selectedDay.format("YYYY-MM-DD")
    await loadMonth()
})

todayButton.addEventListener("click", async () => {
    selectedDay = dayjs()
    currentMonth = selectedDay.startOf("month")
    selectedDate.value = selectedDay.format("YYYY-MM-DD")
    await loadMonth()
})

tabs.forEach((tab) => {
    tab.addEventListener("click", () => switchView(tab.dataset.view))
})

serviceForm.addEventListener("submit", saveService)
serviceCancel.addEventListener("click", resetServiceForm)
barberForm.addEventListener("submit", saveBarber)
barberCancel.addEventListener("click", resetBarberForm)
availabilityForm.addEventListener("submit", saveAvailability)
blockForm.addEventListener("submit", saveBlock)
teamForm.addEventListener("submit", saveTeamMember)
teamCancel.addEventListener("click", resetTeamForm)

;(async () => {
    const allowed = await ensureAccess()
    if (!allowed) return

    selectedDate.value = selectedDay.format("YYYY-MM-DD")
    blockDate.value = selectedDay.format("YYYY-MM-DD")
    await loadMonth()
})()
