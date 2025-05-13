# Contributing Guide

Thank you for considering contributing to Browser Console MCP! Here are some guidelines to help you get started.

## Development Environment Setup

1. Fork this repository
2. Clone your fork
   ```bash
   git clone https://github.com/YOUR_USERNAME/browser-console-mcp.git
   cd browser-console-mcp
   ```
3. Install dependencies
   ```bash
   pnpm install
   ```
4. Build the project
   ```bash
   pnpm build:all
   ```

## Development

### Directory Structure

- `src/server/`: MCP server-side code
- `src/client/`: Browser console client code
- `src/browser/`: Browser MCP server code
- `bin/`: CLI tools and scripts

### Development Workflow

1. Create a new branch
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make changes and test
   ```bash
   # Start development mode
   pnpm dev
   
   # Start the server in another terminal
   pnpm start
   ```

3. Commit your changes
   ```bash
   git commit -m "feat: add new feature"
   ```

4. Push to your fork
   ```bash
   git push origin feature/your-feature-name
   ```

5. Create a Pull Request

## Commit Convention

We use the [Conventional Commits](https://www.conventionalcommits.org/) specification. Please ensure your commit messages follow this format:

```
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

Types can be:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Changes that do not affect code meaning (whitespace, formatting, etc.)
- `refactor`: Code changes that neither fix a bug nor add a feature
- `perf`: Code changes that improve performance
- `test`: Adding or correcting tests
- `chore`: Changes to the build process or auxiliary tools and libraries

## Code Style

Please ensure your code follows the project's code style. We use TypeScript and ESLint.

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License. 