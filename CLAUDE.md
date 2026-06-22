# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A2UI is a monorepo-based platform that enables AI-powered UI generation through natural language conversations. The system allows users to generate UI interfaces via AI agents, preview them, and iteratively refine them through multi-turn conversations.

## Project Structure

- **packages/** - Core UI libraries
  - `@a2ui/core`: Contains the UI component system and rendering engine
    - `parser`: Parses A2UI protocol specifications
    - `vnode`: Manages component virtual DOM mappings
    - `treeBuilder`: Generates rendering trees from A2UI protocol
  - `@a2ui/react`: React-based implementation of the A2UI rendering engine

- **web/** - Playground application
  - `a2ui-playground`: Web application for UI generation and preview
    - AI agent interface for UI generation
    - Multi-turn conversation support for UI refinement
    - Component library preview system
    - Protocol debugging capabilities

- **server/** - Backend services
  - `a2ui-playground-server`: Server implementation
    - OpenAI integration for A2UI agent functionality
    - A2UI protocol generation and caching service
    - Koa-based API endpoints

## Essential Commands

### Development
- `pnpm dev:playground` - Start the web playground application (Vite)
- `pnpm dev:server` - Start the backend server (ts-node with Koa)

### Building
- `pnpm build:core` - Build the core A2UI library
- `pnpm build:react` - Build the React renderer
- `pnpm build:packages` - Build all package dependencies
- `pnpm build:playground` - Build the playground application
- `pnpm build` - Build the entire project

### Maintenance
- `pnpm clean` - Remove all node_modules and dist directories across the monorepo

## Development Notes

- The project uses TypeScript across all components
- Web application is built with Vite
- Server uses Koa for API endpoints and ts-node for development
- Package management is handled by pnpm workspaces
- Node.js >=18.0 and pnpm >=8.0 are required
- The monorepo structure requires using `--filter` flags with pnpm for targeted operations