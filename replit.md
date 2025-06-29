# StockFlow - Inventory Management System

## Overview

StockFlow is a full-stack inventory management system built with React, Express.js, and PostgreSQL. It provides real-time inventory tracking with role-based authentication using Replit's OIDC system. The application features a modern UI with shadcn/ui components and real-time updates via WebSocket connections.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit OIDC with Passport.js
- **Session Management**: Express sessions with PostgreSQL store
- **Real-time Communication**: WebSocket server for live updates
- **API Design**: RESTful endpoints with proper error handling

### Database Design
- **ORM**: Drizzle with type-safe schema definitions
- **Connection**: Neon serverless PostgreSQL with connection pooling
- **Migrations**: Drizzle Kit for schema management
- **Tables**: Users, categories, products, stock movements, and sessions

## Key Components

### Authentication System
- **Provider**: Replit OIDC integration
- **Session Storage**: PostgreSQL-backed sessions with connect-pg-simple
- **Role-based Access**: Admin, manager, and employee roles
- **Security**: HTTP-only cookies with secure flags

### Inventory Management
- **Products**: Complete CRUD operations with categorization
- **Stock Tracking**: Real-time stock level monitoring
- **Stock Movements**: Detailed audit trail of all inventory changes
- **Barcode Support**: Scanner integration for quick product lookup
- **Low Stock Alerts**: Automated notifications for inventory thresholds
- **AI-Powered Analytics**: Intelligent demand forecasting and stock optimization

### AI Inventory Capabilities
- **Demand Forecasting**: Predicts future product demand using historical data
- **Smart Insights**: Automated analysis of inventory patterns and trends
- **Reorder Recommendations**: AI-generated alerts for optimal restocking
- **Stock Optimization**: Intelligent suggestions for optimal inventory levels
- **Cost Impact Analysis**: Evaluates financial impact of inventory decisions

### User Interface
- **Responsive Design**: Mobile-first approach with adaptive layouts
- **Real-time Updates**: WebSocket integration for live data sync
- **Form Validation**: React Hook Form with Zod schema validation
- **Toast Notifications**: User feedback for all actions
- **Dashboard**: Overview widgets with key metrics and recent activity

### Data Management
- **Type Safety**: End-to-end TypeScript with shared schema types
- **Query Optimization**: Efficient database queries with proper indexing
- **Error Handling**: Comprehensive error boundaries and API error responses
- **Data Validation**: Server-side validation using Zod schemas

## Data Flow

1. **Authentication Flow**:
   - User initiates login through Replit OIDC
   - Server validates credentials and creates session
   - Client receives authenticated state via cookie
   - Protected routes enforce authentication middleware

2. **Inventory Operations**:
   - Client submits inventory changes via REST API
   - Server validates data and updates database
   - WebSocket broadcasts changes to all connected clients
   - UI updates reactively through TanStack Query invalidation

3. **Real-time Synchronization**:
   - WebSocket connection established on client load
   - Server broadcasts inventory updates to all clients
   - Client invalidates relevant queries and refetches data
   - UI updates automatically without manual refresh

## External Dependencies

### Database & Infrastructure
- **@neondatabase/serverless**: Serverless PostgreSQL connection
- **drizzle-orm**: Type-safe ORM with PostgreSQL dialect
- **connect-pg-simple**: PostgreSQL session store

### Authentication & Security
- **openid-client**: OIDC client implementation
- **passport**: Authentication middleware
- **express-session**: Session management

### Frontend Libraries
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form handling and validation
- **@hookform/resolvers**: Form validation resolvers
- **wouter**: Lightweight React router
- **date-fns**: Date manipulation utilities

### UI Components
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js with tsx for TypeScript execution
- **Hot Reload**: Vite development server with HMR
- **Database**: Automatic Neon database provisioning
- **Environment Variables**: DATABASE_URL, SESSION_SECRET, REPLIT_DOMAINS

### Production Build
- **Frontend**: Vite builds optimized React bundle
- **Backend**: esbuild bundles Node.js server
- **Assets**: Static files served from dist/public
- **Database Migrations**: Drizzle Kit push for schema updates

### Replit Integration
- **Cartographer**: Development tooling integration
- **Error Overlay**: Runtime error display in development
- **Banner**: Development environment identification

## Changelog
- June 27, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.