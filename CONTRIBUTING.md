# Contributing to ChittyCloud MCP

We welcome contributions to ChittyCloud MCP! This document provides guidelines for contributing to the project.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Development Setup
1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/yourusername/chittycloud-mcp.git
   cd chittycloud-mcp
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Test the installation:
   ```bash
   npm test
   ```

## 🛠️ Development Workflow

### Making Changes
1. Create a new branch from main:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Test your changes:
   ```bash
   npm run test
   npm run qa
   ```
4. Commit your changes:
   ```bash
   git commit -m "feat: add your feature description"
   ```
5. Push to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```
6. Create a Pull Request

### Testing
- Run the QA suite: `npm run qa`
- Run security tests: `npm run security-test`
- Test with real MCP clients: `npm run dev`

## 📝 Code Standards

### Security First
- All input must be validated with Zod schemas
- Never log sensitive data (API keys, tokens)
- Use rate limiting for public endpoints
- Sanitize all user inputs

### Code Style
- Use TypeScript for new features
- Follow existing naming conventions
- Add JSDoc comments for public functions
- Use meaningful variable names

### Commit Messages
We use conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes  
- `docs:` - Documentation changes
- `test:` - Test additions/changes
- `refactor:` - Code refactoring
- `security:` - Security improvements

## 🔌 Adding New Platforms

To add support for a new cloud platform:

1. Create a new adapter class in `secure-index.js`:
   ```javascript
   class NewPlatformAdapter {
     constructor() {
       this.platform = 'newplatform';
       this.authenticated = false;
     }
     
     async authenticate(credentials) { /* implementation */ }
     async deploy(config) { /* implementation */ }
     async getStatus(deploymentId) { /* implementation */ }
   }
   ```

2. Add to platform registry:
   ```javascript
   platformAdapters.set('newplatform', new NewPlatformAdapter());
   ```

3. Update schemas:
   ```javascript
   const PlatformSchema = z.enum(['cloudflare', 'vercel', 'railway', 'newplatform']);
   ```

4. Add documentation to README.md
5. Add tests for the new platform

## 🧪 Testing Guidelines

### Required Tests
- Security penetration tests
- Input validation tests  
- API integration tests
- Error handling tests
- Performance tests

### Test Structure
```javascript
// Example test
const result = await testMCPCall({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "your-tool",
    arguments: { /* test args */ }
  }
});

// Assertions
expect(result.response).toBeDefined();
expect(result.response.error).toBeUndefined();
```

## 🐛 Bug Reports

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node.js version, OS, etc.)
- Error logs (with sensitive data removed)

## 💡 Feature Requests

For new features:
- Check existing issues first
- Provide clear use case description
- Consider backwards compatibility
- Include implementation suggestions if possible

## 🔒 Security Issues

For security vulnerabilities:
- **DO NOT** create a public issue
- Email security@chitty.cc directly
- Include detailed reproduction steps
- We'll respond within 24 hours

## 📖 Documentation

When adding features:
- Update README.md with new tools/capabilities
- Add usage examples
- Update INSTALL.md if setup changes
- Include JSDoc comments for all public functions

## 🎯 Platform-Specific Guidelines

### Cloudflare Integration
- Use official Cloudflare APIs
- Follow Cloudflare Workers best practices
- Test with multiple account types (free/paid)

### Vercel Integration  
- Use Vercel API v13 (latest)
- Support both personal and team accounts
- Handle framework detection properly

### Railway Integration
- Follow Railway API patterns
- Support both apps and databases
- Handle service linking correctly

## 📋 Pull Request Checklist

Before submitting:
- [ ] Tests pass (`npm run test`)
- [ ] Security tests pass (`npm run security-test`) 
- [ ] QA suite passes (`npm run qa`)
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Commit messages follow conventions
- [ ] No sensitive data in code/commits
- [ ] Changes are backwards compatible

## 🤝 Code Review Process

1. All PRs require review from maintainers
2. Security-related changes require 2+ reviews
3. We'll provide constructive feedback
4. Address review comments promptly
5. Squash commits before merge

## 🏆 Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Recognized in release notes
- Given appropriate repository permissions

## 📞 Getting Help

- Create a discussion for questions
- Join our community chat (link coming soon)
- Email support@chitty.cc for urgent issues

Thank you for contributing to ChittyCloud MCP! 🌩️