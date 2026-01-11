# Linux Migration Guide for CTRL Extension

## ✅ Compatibility Status
This project is **fully compatible** with Linux. The tech stack (Node.js, WXT, React, TypeScript) is cross-platform.

## 🚀 Migration Steps

1.  **Transfer the Code**
    - Copy the `extension` directory to your Linux machine.
    - **IMPORTANT**: It is recommended to **delete/exclude `node_modules`** before copying, and reinstall fresh on Linux to ensure any binary dependencies are built for the correct architecture.

2.  **Environment Setup**
    - Install Node.js (Latest LTS recommended).
      ```bash
      # Example via nvm (Node Version Manager)
      nvm install --lts
      ```

3.  **Installation**
    - Navigate to the project folder.
    - Install dependencies.
      ```bash
      npm install
      ```

4.  **Running the Project**
    - Start the development server (auto-reloads Firefox/Chrome):
      ```bash
      npm run dev
      # OR specific browser
      npm run dev:firefox
      ```

5.  **Building for Production**
    - Generate the drag-and-drop `.zip` files:
      ```bash
      npm run zip:firefox
      npm run zip:chrome
      ```
    - The output will be in `.output/` or `builds/` depending on the config.

## ℹ️ Key Differences
- **Scripts**: You can just run `npm run <script>` normally. The `npm.cmd` usage seen in Windows logs is Windows-specific but `npm` works everywhere.
- **File Paths**: Linux is case-sensitive. The project has been audited for this (e.g., imports match file casing), but if you encounter "File not found" errors, check the capitalization of imports vs filenames.

## 🛠 Troubleshooting
- **Permission Denied**: If you get EACCES errors, ensure you have ownership of the files or use `sudo` (though `npm` should generally run without sudo).
- **Manifest Errors**: If builds fail, try running `npm run clean` (if available) or manually verify `wxt.config.ts`.
