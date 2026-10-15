# 1. Visão geral

## O que é o Voxa

O Voxa é um espaço de comunicação para comunidades: grupos de estudo, coletivos, projetos de software livre, ONGs, clubes, amigos. Cada comunidade (chamada de **servidor**) tem **canais de texto**, onde as conversas ficam registradas, e **canais de voz**, salas onde as pessoas entram e saem livremente para conversar, ligar a câmera ou **compartilhar a tela**.

## Por que um projeto sem fins lucrativos

As plataformas comerciais equivalentes financiam-se com assinaturas que limitam qualidade (resolução da tela, tamanho de arquivos), com dados de uso ou com publicidade. O Voxa parte de outra premissa:

| Tema | Voxa |
|---|---|
| Financiamento | Doações transparentes (ex.: Open Collective), patrocínio institucional, editais de fomento |
| Qualidade de chamada | Definida pela **capacidade da instância**, não por plano pago |
| Dados | Coleta mínima; sem telemetria de terceiros; métricas agregadas e anônimas |
| Controle | Qualquer pessoa pode hospedar sua instância e exportar seus dados |
| Governança | Decisões públicas via ADRs e issues; código aberto ([ADR-0001](adr/0001-licenca.md)) |

## Objetivos

1. **Chat confiável** — mensagens entregues em ordem, sem duplicatas, com histórico pesquisável, anexos, reações, respostas e menções.
2. **Voz de baixa latência** — entrar numa sala em menos de 2 s; latência fim a fim abaixo de 200 ms na mesma região.
3. **Compartilhamento de tela fluido** — até 1080p a 30 fps por padrão; 60 fps e resoluções maiores quando a instância permitir.
4. **Fácil de hospedar** — uma instância pequena (até ~200 pessoas simultâneas) roda num único servidor modesto.
5. **Acessível** — leitor de tela, navegação por teclado, contraste, legendas (roadmap) e internacionalização desde o início.

## Fora do escopo (por enquanto)

- Federação entre instâncias (avaliar compatibilidade com Matrix no futuro — ver [Roadmap](11-roadmap.md)).
- Monetização, lojas, assinaturas.
- Criptografia ponta a ponta do **chat de texto** em canais públicos de servidor (as chamadas têm E2EE; DMs com E2EE estão no roadmap).
- Bots com execução de código no servidor (bots externos via API sim).

## Público e personas

| Persona | Necessidade principal |
|---|---|
| **Participante** | Conversar por texto e voz sem fricção, em qualquer dispositivo |
| **Moderador(a)** | Ferramentas de moderação, cargos e permissões claras |
| **Administrador(a) de instância** | Instalar, atualizar, monitorar e fazer backup com pouco esforço |
| **Contribuidor(a)** | Código legível, documentação, ambiente local em minutos |

## Glossário

| Termo | Significado |
|---|---|
| **Instância** | Uma implantação do Voxa (ex.: `voxa.exemplo.org`) |
| **Servidor** | Uma comunidade dentro da instância, com membros, cargos e canais |
| **Canal de texto** | Canal com histórico de mensagens |
| **Canal de voz** | Sala de áudio/vídeo; ninguém "liga" para ninguém, as pessoas entram |
| **DM / grupo** | Conversa privada entre 2 ou mais pessoas, fora de um servidor |
| **Gateway** | Serviço WebSocket que entrega eventos em tempo real ao cliente |
| **SFU** | *Selective Forwarding Unit*: servidor de mídia que recebe o fluxo de cada participante e o repassa aos demais, sem misturar |
| **Transmissão (stream)** | Compartilhamento de tela de alguém dentro de um canal de voz |
| **Snowflake** | ID numérico de 64 bits, ordenável por tempo, usado em todas as entidades |
| **E2EE** | Criptografia ponta a ponta: nem o servidor consegue ler o conteúdo |
