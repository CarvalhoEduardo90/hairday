"use strict"

import "./libs/dayjs.js"
import "./styles/global.css"
import "./styles/form.css"
import "./styles/schedule.css"

import dayjs from "dayjs"
import { supabase, getAccessToken } from "./libs/supabase-client.js"
import { apiConfig } from "./services/api-config.js"
import { openingHours } from "./utils/opening-hours.js"

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
const tabs = document.querySelectorAll(".admin-tab")
const views = {
    agenda: document.getElementById("agenda-view"),
    services: document.getElementById("services-view"),
    barbers: document.getElementById("barbers-view"),
}
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

let currentMonth = dayjs().startOf("month")
let selectedDay = dayjs()
let monthSchedules = []
let loadRequestId = 0
let servicesLoaded = false
let barbersLoaded = false
let servicesCache = []
let barbersCache = []
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

async function authFetch(path, options = {}) {
    const token = await getAccessToken()
    return fetch(`${apiConfig.baseURL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    })
}

async function ensureAdmin() {
    const token = await getAccessToken()
    if (!token) {
        window.location.href = "login.html"
        return false
    }

    const response = await authFetch("/me")
    if (!response.ok) {
        window.location.href = "login.html"
        return false
    }

    const me = await response.json()
    if (!me.isAdmin) {
        alert("Acesso restrito ao administrador.")
        await supabase.auth.signOut()
        window.location.href = "login.html"
        return false
    }
    return true
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
    const current = dayjs(schedule.when).format("HH:00")
    const input = prompt(
        `Novo horario para ${schedule.name} (formato HH:00).\n` +
            `Horarios: ${openingHours.join(", ")}`,
        current
    )
    if (!input) return

    const value = input.trim()
    if (!openingHours.includes(value)) {
        return alert("Horario invalido. Use um dos horarios de funcionamento.")
    }

    const [hour] = value.split(":")
    const when = dayjs(schedule.when)
        .startOf("day")
        .add(Number(hour), "hour")
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

;(async () => {
    const allowed = await ensureAdmin()
    if (!allowed) return

    selectedDate.value = selectedDay.format("YYYY-MM-DD")
    await loadMonth()
})()
