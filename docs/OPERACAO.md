# Operação, release e incidentes

## Ambientes

Use projetos Supabase e arquivos de segredo distintos para `dev`, `staging` e
`production`. Nunca copie dados reais para desenvolvimento. A chave
`service_role` existe apenas no gateway e no worker.

## Release

1. executar o gate local e registrar em `docs/TESTES.md`;
2. aplicar migrations em staging e executar pgTAP;
3. executar E2E e teste manual de aceite;
4. criar backup e registrar o ponto de restauração;
5. promover o mesmo artefato para produção;
6. verificar health, fila, erro, latência e jornada curta;
7. observar por 30 minutos antes de encerrar a janela.

## Rollback

Frontend e serviços: voltar ao artefato anterior. Banco: migrations são
incrementais e devem preferir roll-forward; restauração só com aprovação do
responsável e backup validado. Não remover colunas/tabelas na mesma release que
deixa de usá-las.

## Alertas mínimos

- health indisponível por 2 minutos;
- taxa de erro de job acima de 5% em 10 minutos;
- job `running` por mais de 10 minutos;
- fila mais antiga que 5 minutos;
- p95 do gateway acima de 3 segundos fora de streaming;
- falha de backup ou teste de restauração.

## Incidente

Registrar início, impacto, responsável, IDs de correlação, contenção, decisão
de rollback, recuperação e revisão sem culpa. Incidente de privacidade aciona
imediatamente o responsável legal e preserva evidências.

## Dados do titular

Até existir autoatendimento, solicitações de exportação/exclusão devem ser
autenticadas pelo canal oficial, registradas e executadas por procedimento
aprovado. O Go Live público permanece bloqueado enquanto esse canal e a
automação não existirem.

