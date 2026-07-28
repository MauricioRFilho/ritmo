# Agente de Gateway de IA

Responsável por FastAPI, worker, schemas por operação, idempotência, cotas,
retry, recuperação de jobs, cancelamento, persistência e correlação.

Testes mínimos: schemas válidos e inválidos, autenticação, isolamento de jobs,
timeout/retry, job preso, indisponibilidade do Ollama e streaming interrompido.
Nenhuma saída de modelo chega ao domínio sem validação.

