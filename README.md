# Saint Michel Leads

Landing page com captação de leads, painel administrativo protegido por JWT, PostgreSQL, Prisma, Resend e Evolution API.

## Primeiros passos

1. Copie `.env.example` para `.env`.
2. Preencha `DATABASE_URL`, `JWT_SECRET` e o usuário inicial.
3. Rode as migrations com `pnpm prisma:migrate`.
4. Crie o primeiro admin com `pnpm seed`.
5. Rode localmente com `pnpm dev`.

## Variáveis na Vercel

Configure as mesmas variáveis da `.env.example` em Project Settings > Environment Variables.
