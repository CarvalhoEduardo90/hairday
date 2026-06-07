import {
    barberOptions,
    formatPrice,
    serviceOptions,
} from "../../data/appointment-options.js"
import { apiConfig } from "../../services/api-config.js"

const serviceList = document.getElementById("service-options")
const barberSelect = document.getElementById("barber-select")
const serviceSummary = document.getElementById("service-summary")
const serviceSummaryPrice = document.getElementById("service-summary-price")

let selectedService = null
let services = [...serviceOptions]
let barbers = [...barberOptions]

function notifyOptionChange() {
    window.dispatchEvent(new CustomEvent("appointment:options-change"))
}

function renderServices() {
    serviceList.innerHTML = ""

    if (services.length === 0) {
        const empty = document.createElement("p")
        empty.classList.add("service-empty")
        empty.textContent = "Nenhum servico ativo no momento."
        serviceList.appendChild(empty)
        return
    }

    services.forEach((service) => {
        const button = document.createElement("button")
        button.type = "button"
        button.classList.add("service-option")
        button.dataset.serviceId = service.id
        const isSelected = selectedService?.id === service.id
        button.classList.toggle("service-option-selected", isSelected)
        button.setAttribute("aria-pressed", String(isSelected))

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
    const selectedBarberId = barberSelect.value
    barberSelect.innerHTML = ""

    barbers.forEach((barber) => {
        const option = document.createElement("option")
        option.value = barber.id
        option.textContent = barber.name
        barberSelect.appendChild(option)
    })

    if (barbers.some((barber) => barber.id === selectedBarberId)) {
        barberSelect.value = selectedBarberId
    }

    barberSelect.onchange = notifyOptionChange
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
    if (!selectedService) return null
    return services.find((service) => service.id === selectedService.id) || null
}

export function getSelectedBarber() {
    return (
        barbers.find((barber) => barber.id === barberSelect.value) ||
        barbers[0]
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
loadRemoteOptions()

async function loadRemoteOptions() {
    try {
        const [servicesResponse, barbersResponse] = await Promise.all([
            fetch(`${apiConfig.baseURL}/services`),
            fetch(`${apiConfig.baseURL}/barbers`),
        ])

        if (servicesResponse.ok) {
            const remoteServices = await servicesResponse.json()
            if (Array.isArray(remoteServices)) {
                services = remoteServices
                if (selectedService) {
                    selectedService =
                        services.find((service) => service.id === selectedService.id) ||
                        null
                }
            }
        }

        if (barbersResponse.ok) {
            const remoteBarbers = await barbersResponse.json()
            if (Array.isArray(remoteBarbers)) {
                barbers = [barberOptions[0], ...remoteBarbers]
            }
        }

        renderServices()
        renderBarbers()
        syncSelectedServiceSummary()
        notifyOptionChange()
    } catch (error) {
        console.log(error)
    }
}

function syncSelectedServiceSummary() {
    if (!selectedService) {
        serviceSummary.textContent = "Escolha o servico"
        serviceSummaryPrice.textContent = "Ver precos"
        return
    }

    serviceSummary.textContent = selectedService.name
    serviceSummaryPrice.textContent = formatPrice(selectedService.priceCents)
}
