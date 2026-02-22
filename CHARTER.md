# ChittyCloude MCP Charter

## Classification
- **Canonical URI**: `chittycanon://core/services/chittycloude-mcp`
- **Tier**: 5 (Application)
- **Organization**: chittyapps
- **Domain**: chittycloude-mcp.chitty.cc

## Mission

Universal cloud deployment extension for Cloudflare, Vercel, Railway and more. Provides MCP-based deployment tooling.

## Scope

### IS Responsible For
- Multi-platform cloud deployment via MCP, Cloudflare/Vercel/Railway integration

### IS NOT Responsible For
- Identity generation (ChittyID)
- Token provisioning (ChittyAuth)

## Dependencies

| Type | Service | Purpose |
|------|---------|---------|
| Upstream | ChittyAuth | Authentication |

## API Contract

**Base URL**: https://chittycloude-mcp.chitty.cc

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Service health |

## Ownership

| Role | Owner |
|------|-------|
| Service Owner | chittyapps |

## Compliance

- [ ] Registered in ChittyRegister
- [ ] Health endpoint operational at /health
- [ ] CLAUDE.md present
- [ ] CHARTER.md present
- [ ] CHITTY.md present

---
*Charter Version: 1.0.0 | Last Updated: 2026-02-21*