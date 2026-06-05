# Plano - Disponibilidade configuravel pelo admin

## Objetivo

Permitir que o administrador configure a agenda da barbearia sem precisar alterar
codigo, controlando horarios de funcionamento, duracao de atendimento,
intervalos, bloqueios pontuais e fechamento por data.

## Entendimento do fluxo desejado

O admin deve conseguir:

- definir horarios de funcionamento por dia da semana;
- configurar intervalos entre horarios disponiveis;
- definir a duracao de cada atendimento, como 30 min, 45 min, 1h ou 1h45;
- bloquear horarios especificos para impedir agendamentos;
- marcar o salao como fechado em uma data especifica;
- criar excecoes para datas especiais, como feriados, manutencao ou agenda
  reduzida.

## Modelo sugerido

Separar a disponibilidade em tres camadas.

### 1. Configuracao semanal padrao

Regras recorrentes de funcionamento.

Exemplos:

- segunda a sexta: aberto das 09:00 as 19:00;
- sabado: aberto das 09:00 as 13:00;
- domingo: fechado;
- pausa recorrente para almoco das 13:00 as 14:00.

Campos provaveis:

- dia da semana;
- aberto/fechado;
- hora inicial;
- hora final;
- pausas recorrentes;
- intervalo entre slots.

### 2. Excecoes por data

Regras especificas que sobrescrevem a configuracao semanal.

Exemplos:

- fechar o dia inteiro em um feriado;
- abrir em horario especial em uma data especifica;
- bloquear apenas uma faixa de horario, como 15:00 as 17:00.

Campos provaveis:

- data;
- tipo: fechado, horario especial ou bloqueio parcial;
- hora inicial;
- hora final;
- motivo opcional.

### 3. Servicos

Configuracao dos tipos de atendimento.

Exemplos:

- Corte simples: 30 min;
- Corte + barba: 45 min;
- Atendimento completo: 1h;
- Procedimento especial: 1h45.

Campos provaveis:

- nome;
- duracao em minutos;
- preco opcional;
- ativo/inativo.

## Sugestao de implementacao por fases

### Fase 1 - Duracao padrao e horario semanal

Implementar primeiro uma configuracao simples:

- duracao padrao do atendimento;
- intervalo entre horarios;
- dias da semana abertos/fechados;
- hora inicial e final por dia.

Nesta fase ainda pode existir apenas um tipo de atendimento.

### Fase 2 - Geracao correta de horarios disponiveis

Ajustar a API e o front para gerar horarios com base na configuracao do admin.

O sistema deve considerar:

- horario de abertura e fechamento;
- duracao do atendimento;
- intervalo entre slots;
- agendamentos ja existentes;
- impossibilidade de encaixar atendimento que ultrapasse o horario de fechamento.

### Fase 3 - Bloqueios e fechamento por data

Adicionar excecoes por data:

- dia inteiro fechado;
- bloqueio parcial de horario;
- horario especial em uma data especifica.

Essas excecoes devem ter prioridade sobre a regra semanal.

### Fase 4 - Multiplos servicos

Depois que a agenda configuravel estiver estavel, adicionar tipos de servico com
duracoes diferentes.

O cliente escolheria o servico antes de ver os horarios disponiveis, porque a
duracao influencia diretamente quais horarios podem ser oferecidos.

## Ponto tecnico importante

Hoje o sistema bloqueia conflito por horario exato. Com duracao variavel, isso
nao e suficiente.

Exemplo:

- agendamento A: 10:00 ate 10:45;
- agendamento B nao pode iniciar as 10:30, porque haveria sobreposicao.

Sera necessario validar conflito por intervalo:

- inicio do novo atendimento;
- fim do novo atendimento;
- inicio dos atendimentos existentes;
- fim dos atendimentos existentes.

Essa validacao deve existir no backend e, se possivel, tambem no banco, para
evitar conflito mesmo se duas pessoas tentarem agendar ao mesmo tempo.

## Sugestao de tela para o admin

Criar uma area de configuracao dentro do painel admin, por exemplo:

- `admin.html` com aba/link para "Configuracoes";
- ou nova pagina `configuracoes.html`.

Secoes sugeridas:

- Horario semanal;
- Duracao e intervalo;
- Datas bloqueadas;
- Servicos.

## Checklist antes de implementar

- Confirmar se inicialmente havera um unico servico ou varios servicos.
- Confirmar quais dias e horarios padrao da barbearia.
- Confirmar se o intervalo entre slots deve ser igual a duracao do atendimento
  ou configuravel separadamente.
- Confirmar se o admin precisa bloquear apenas dias inteiros no inicio ou tambem
  faixas de horario.
- Planejar migracao do banco sem quebrar agendamentos existentes.

