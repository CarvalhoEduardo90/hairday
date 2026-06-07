import {
    barberOptions,
    formatPrice,
    serviceOptions,
} from "../../data/appointment-options.js"

const serviceList = document.getElementById("service-options")
const barberSelect = document.getElementById("barber-select")
const serviceSummary = document.getElementById("service-summary")
const serviceSummaryPrice = document.getElementById("service-summary-price")

let selectedService = null

function notifyOptionChange() {
    window.dispatchEvent(new CustomEvent("appointment:options-change"))
}

function renderServices() {
    serviceList.innerHTML = ""

    serviceOptions.forEach((service) => {
        const button = document.createElement("button")
        button.type = "button"
        button.classList.add("service-option")
        button.dataset.serviceId = service.id
        button.setAttribute("aria-pressed", "false")

        const name = document.createElement("strong")
        name.textContent = service.name

        const meta = document.createElement("span")
        meta.textContent = `${formatPrice(service.priceCents)} - ${service.durationMinutes} min`

        button.append(name, meta)
        button.addEventListener("click", () => selectService(service))
        serviceList.appendChild(button)
    })
}

function renderBarbers() {
    barberSelect.innerHTML = ""

    barberOptions.forEach((barber) => {
        const option = document.createElement("option")
        option.value = barber.id
        option.textContent = barber.name
        barberSelect.appendChild(option)
    })

    barberSelect.addEventListener("change", notifyOptionChange)
}

function selectService(service) {
    selectedService = service

    document.querySelectorAll(".service-option").forEach((button) => {
        const selected = button.dataset.serviceId === service.id
        button.classList.toggle("service-option-selected", selected)
        button.setAttribute("aria-pressed", String(selected))
    })

    serviceSummary.textContent = service.name
    serviceSummaryPrice.textContent = formatPrice(service.priceCents)

    notifyOptionChange()
}

export function getSelectedService() {
    return selectedService
}

export function getSelectedBarber() {
    return (
        barberOptions.find((barber) => barber.id === barberSelect.value) ||
        barberOptions[0]
    )
}

export function resetServiceSelection() {
    selectedService = null
    serviceSummary.textContent = "Escolha o servico"
    serviceSummaryPrice.textContent = "Ver precos"
    barberSelect.value = ""

    document.querySelectorAll(".service-option").forEach((button) => {
        button.classList.remove("service-option-selected")
        button.setAttribute("aria-pressed", "false")
    })
}

renderServices()
renderBarbers()
