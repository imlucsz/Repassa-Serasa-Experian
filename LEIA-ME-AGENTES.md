# RePassa — kit de trabalho autônomo (v1.0 | 19/11/2026)

Objetivo: preparar o repositório público `imlucsz/Repassa-Serasa-Experian` para Codex e Devin, sem alterar o site ou o vídeo aprovados. Apresentação: **12/12/2026**; integração alvo: **07/12**. Este pacote contém especificações propostas, não a implementação do produto.

## Instalação (Windows PowerShell 5.1)

1. Na pasta Git atualizada, execute `git status --short` e confirme que não há trabalho local que possa ser sobrescrito. Faça backup de alterações que ainda não foram salvas. Execute `git switch main`, `git pull --ff-only origin main`, depois `git switch -c chore/agent-foundation` (se a branch já existir, inspecione-a antes de reutilizar).
2. Extraia o ZIP **na raiz do clone** (a pasta que contém `.git`, `src` e `package.json`), inclusive as pastas com ponto. Não extraia dentro de uma pasta extra. Se surgir conflito de arquivo, pare e compare as versões; não aceite substituição automática. Nenhum arquivo existente na árvore `main` consultada foi incluído para sobrescrita.
3. Confira Node e Git: `node --version` (preferência Node 22, pelo menos 22.12 para o Vite atual) e `git --version`.
4. Execute `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-agent-env.ps1` (o Bypass é apenas para esse processo, não muda política global). O script ativa hooks somente neste repositório, roda testes da proteção e não instala dependências, não faz commit nem push.
5. Confira `git status`, `git config --local --get core.hooksPath`. Adicione somente os arquivos do kit com o comando abaixo; revise o diff antes do commit.

```powershell
git add .gitattributes AGENTS.md LEIA-ME-AGENTES.md docs/repassa src/AGENTS.md backend/AGENTS.md .agents .githooks .github scripts
git add --chmod=+x .githooks/pre-commit .githooks/pre-push
git diff --cached --stat
node scripts/agent-guard.mjs staged
git commit -m "chore: establish agent context and quality gates"
git push -u origin chore/agent-foundation
```

6. Crie um PR para `main`. Se `frontend-quality` falhar por problema anterior, registre e corrija a causa em PR (não declare o baseline verde sem rodar). Faça merge pelo GitHub quando revisado e aprovado. Os documentos poderão ser ajustados no PR de fundação.
7. Ative a proteção de `main`, conforme `docs/repassa/GIT_WORKFLOW.md`. Ela é necessária para impor os checks também aos agentes remotos. Os hooks são locais; cada clone/DevBox precisa ativá-los. Não configure bypass para agentes.
8. Reinicie Codex na raiz do projeto e abra a tarefa de Devin depois de `main` conter o kit. Use os prompts de `docs/repassa/agent-prompts/`. No Devin Repo Setup, configure `bash scripts/setup-agent-env.sh` como etapa de preparação de cada clone e faça manutenção com `npm ci` na raiz e, quando implementado, no backend. Se o ambiente não executar essa etapa a cada clone, inclua no prompt inicial. Não precisa inserir chaves reais no repositório.

## O que é automático e o que não é
- Codex pode ler `AGENTS.md` e arquivos mais específicos; habilidades locais em `.agents/skills` são auxiliares. Devin recebe a instrução explícita de ler esses arquivos. Não presumo descoberta de contextos idêntica entre ferramentas.
- Git hooks invocam um guard em Node sem dependências. CI valida o guard, frontend e, quando existente, backend. Não são garantias absolutas nem substituem revisão.
- Não modifiquei seu GitHub, não ativei rulesets, não instalei dependências do produto e não executei build do site real. Os testes do guard são independentes.
- Este kit não contém `.env`, chaves, código funcional NestJS ou novas telas. O contrato v0.1 e as regras ajustáveis devem ser aceitos pelos dois agentes antes de avançar; decisões em aberto ficam em `DECISIONS.md`.
- Hooks nativos do Codex não foram instalados: escolhi Git hooks portáveis que funcionam também com Devin. Configuração de permissões/sandbox depende da ferramenta e fica a cargo do usuário; prefira acesso ao repositório e rede necessária, não acesso irrestrito ao computador.

## Leitura rápida
`AGENTS.md` → `docs/repassa/INDEX.md` → `PRD.md`, `BUSINESS_RULES.md`, `API.md`, `contracts/openapi.yaml` → `ROADMAP.md` → prompt do agente. `STATUS.md` registra o progresso verificável; cada PR atualiza apenas a tarefa e, se necessário, seus documentos de domínio.

## Resultado de validação do kit
Veja `docs/repassa/VALIDATION-KIT.md` para testes executados e limitações. Para checar localmente, `node --test scripts/agent-guard.test.mjs`.
