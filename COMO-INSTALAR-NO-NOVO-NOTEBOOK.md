# Como instalar no notebook novo

Este pacote contém **o sistema completo e todos os dados já cadastrados**
(processos, usuários, fases e histórico). Siga os 4 passos abaixo.

---

## 1. Instalar o Node.js

O sistema precisa do Node.js versão 22 ou superior (o pacote foi feito com a 24).

Abra o **PowerShell** e rode:

```
winget install OpenJS.NodeJS.LTS
```

Depois **feche e abra o PowerShell de novo** e confirme:

```
node -v
```

Deve aparecer algo como `v24.x.x`. Se aparecer erro, baixe o instalador em
https://nodejs.org e instale normalmente.

---

## 2. Copiar a pasta

Descompacte este pacote e coloque a pasta onde quiser, por exemplo:

```
C:\Users\SEU-USUARIO\Desktop\Emendas
```

> Evite caminhos com acento no nome da pasta, para não dar problema.

---

## 3. Instalar as dependências

No PowerShell, entre na pasta e rode:

```
cd "C:\Users\SEU-USUARIO\Desktop\Emendas"
```

```
npm install
```

Isso baixa as bibliotecas (a pasta `node_modules` não veio no pacote de propósito,
porque ela é grande e é recriada automaticamente).

**Não rode `npm run seed`** — isso recriaria o banco do zero. Seus dados já estão
no arquivo `data\emendas.db` que veio junto.

---

## 4. Iniciar o sistema

```
npm start
```

Abra no navegador: **http://localhost:3000**

Entre com o mesmo login de antes:

- E-mail: `admin@exemplo.gov.br`
- Senha: `Admin@2026`

Todos os processos, usuários e o andamento das linhas do tempo estarão lá.

---

## O que tem dentro do pacote

| Item | O que é |
|---|---|
| `data\emendas.db` | **Seus dados** — processos, usuários, fases, histórico |
| `uploads\` | Anexos dos processos (hoje está vazia) |
| `.env` | Configuração e senha de administrador |
| `src\`, `public\`, `server.js` | O código do sistema |
| `README.md` | Documentação técnica completa |

---

## Avisos importantes

- **O arquivo `.env` contém a senha do administrador e a chave de segurança.**
  Não envie este pacote por e-mail público, WhatsApp de grupo ou nuvem compartilhada.
  Use pendrive, ou apague o `.env` do pacote e recrie ele no notebook novo a partir
  do `.env.example`.

- **Faça backup de vez em quando.** Basta copiar a pasta `data` inteira —
  é ali que fica tudo o que você cadastra.

- **Antes de copiar o banco de novo no futuro**, feche o sistema (Ctrl+C no PowerShell).
  Se copiar com o sistema rodando, copie os três arquivos juntos:
  `emendas.db`, `emendas.db-shm` e `emendas.db-wal` — senão você perde
  o que foi cadastrado mais recentemente.

- **Pode apagar o sistema do notebook antigo** depois de confirmar que tudo abriu certo
  no novo. Confira antes: entre no sistema, veja se os processos estão lá e se a
  linha do tempo de cada um está na fase correta.
