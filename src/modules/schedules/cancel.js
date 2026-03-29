import { schedulesDay } from "./load.js"
import { scheduleCancel } from "../../services/schedule-cancel.js"
const periods = document.querySelectorAll(".period")
// Gera evento click para cada lista(manha, tarde e noite).
periods.forEach((period) => {
    // Captura o envento de click na lista.
    period.addEventListener("click", async (event) => {
        if(event.target.classList.contains("cancel-icon")) {
            // Obtem a li pai do elemento clicado.
            const item = event.target.closest("li")
            // Pega o id do agendamento para remover.
            const { id } = item.dataset
            // Confirma que o id foi selecionado.
            if(id) {
                // Confirma se o usuario quer cancelar o agendamento.
                const isConfirm = confirm(
                    "Tem certeza que deseja cancelar este agendamento?"
                )
                if(isConfirm) {
                    try {
                        // Faz a requisição na API para cancelar.
                        await scheduleCancel({ id })
                        alert("Agendamento cancelado com sucesso!")
                    } catch (error) {
                        console.log(error)
                        alert(error.message || "Não foi possível cancelar o agendamento.")
                    } finally {
                        // Recarrega os agendamentos.
                        await schedulesDay()
                    }
                }
            }
        }
    })
})