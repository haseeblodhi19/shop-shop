# ShopFlow POS

ShopFlow POS is a Windows desktop point-of-sale and shop-management application built with Electron, Express, and SQLite.

## Requirements

- Windows 10 or later, 64-bit
- Node.js 24.x
- npm (included with Node.js)

## Run from source

```powershell
npm ci --ignore-scripts
npm rebuild electron
$env:ProgramData = "$PWD\.dev-data"
npm start
```

The development command stores its test database under `.dev-data` so it does not use an installed ShopFlow database. To run against the normal Windows data location instead, remove the `ProgramData` override before starting the app.

The app listens on `http://127.0.0.1:3000`. Do not run multiple app instances at the same time.

## Build a Windows installer

From Windows PowerShell, run:

```powershell
npm ci --ignore-scripts
npm run build:win
```

The builder downloads Electron as part of the packaging process. The NSIS installer is written to `dist/`. It is a 64-bit, per-machine installer and may request administrator permission. Test the installer with a new/temporary database before giving it to a customer.

## Data and backups

On Windows, normal app data is stored outside the installation folder in `%ProgramData%\SHOP-ERP`. This includes the SQLite database and backups. Do not commit or send database files, backups, or a customer's data with the source code or installer.

Before updating a customer's installation, make a separate backup of their database. Installing a new app version should not replace the database.

On a fresh database, the app asks you to create the first administrator account; there is no shared default login. Existing databases keep their existing users and passwords. If upgrading from an older build, change any old default password in the Users & Passwords section.

## Sharing with a customer

The repository is public, so anyone can view and clone the source. A customer who needs to build it can clone the repository, follow the source setup steps above, and run `npm run build:win`. Send the customer only the generated installer, never a database or backup.

The generated installer is not code-signed. Windows may show a SmartScreen warning; use a trusted code-signing certificate before distributing signed production releases.
