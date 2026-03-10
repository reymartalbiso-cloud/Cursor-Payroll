# Payroll System

A production-ready web application for generating payslips per cutoff (15 days) using imported Excel timesheets and an employee masterlist. Built with Next.js, React, TypeScript, and PostgreSQL.

## Features

### Core Functionality
- **Employee Management**: Full CRUD operations for employee master data
- **Excel Import**: Upload and map Excel timesheets with validation
- **Payroll Runs**: Create and manage payroll runs per cutoff period
- **Payslip Generation**: Auto-generate payslips with detailed calculations
- **KPI Editing**: Edit KPI per employee per payroll run with instant recalculation
- **PDF Export**: Generate and download payslip PDFs
- **Reports**: Payroll summary reports with CSV export

### Business Rules
- **Workdays**: Monday-Saturday only (Sundays excluded from all calculations)
- **Government Deductions**: SSS, PhilHealth, Pag-IBIG applied ONLY for 16-end of month cutoff
- **Cutoff Periods**:
  - First Half: 1st - 15th of the month
  - Second Half: 16th - end of month (auto-detects 28/29/30/31)

### Role-Based Access Control (RBAC)
- **Admin**: Full access to all features
- **Payroll Admin**: Manage employees, payroll runs, and payslips
- **Employee Viewer**: View and download own payslips only

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + React + TypeScript + Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT-based with role-based access control
- **Excel Parsing**: SheetJS (xlsx)
- **UI Components**: Radix UI + shadcn/ui

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   cd payroll-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your database connection and settings:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/payroll_db?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations
   npx prisma migrate dev --name init
   
   # Seed sample data
   npm run db:seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Access the application**
   
   Open [http://localhost:3000](http://localhost:3000) or [https://lifewoodpayroll.vercel.app](https://lifewoodpayroll.vercel.app)

### Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@company.com | admin123 |
| Payroll Admin | payroll@company.com | admin123 |
| Employee | juan.delacruz@company.com | admin123 |

## Excel Import Guide

### Required Columns
The system supports flexible column mapping. Minimum required columns:
- **Employee ID** or **Employee Name** (to match with masterlist)
- **Date** (the attendance date)

### Optional Columns
- Time In
- Time Out
- Minutes Late
- Undertime Minutes
- Absent flag (Yes/No)
- Overtime Hours
- Holiday Pay
- Remarks

### Sample Excel Template

| Employee ID | Employee Name | Date | Time In | Time Out | Minutes Late | Absent | OT Hours |
|-------------|---------------|------|---------|----------|--------------|--------|----------|
| EMP-001 | Juan Dela Cruz | 2025-01-16 | 08:00 | 17:00 | 0 | | 0 |
| EMP-001 | Juan Dela Cruz | 2025-01-17 | 08:15 | 17:00 | 15 | | 0 |
| EMP-002 | Maria Santos | 2025-01-16 | | | 0 | Yes | 0 |

### Import Process

1. Navigate to **Import Timesheet**
2. Upload your Excel file
3. Select the sheet containing the data
4. Select the target Payroll Run
5. Map your columns to the system fields
6. Click **Validate & Continue**
7. Review warnings (missing employees, unrecognized employees)
8. Click **Import** to process

## Payroll Calculation

### Earnings
- **Basic Pay** = Daily Rate × Present Days
- **Overtime Pay** = OT Hours × Hourly Rate × OT Multiplier (default 1.25)
- **Holiday Pay** = From timesheet import
- **KPI** = Editable per employee per payroll run

### Deductions

#### Attendance-Based
- **Absence Deduction** = Daily Rate × Absent Days
- **Late Deduction** = (Daily Rate / Standard Hours / 60) × Late Minutes

#### Government (16-end cutoff ONLY)
- SSS Contribution
- PhilHealth Contribution
- Pag-IBIG Contribution

#### Loans
- SSS Loan
- Pag-IBIG Loan
- Other Loans
- Cash Advance

### Net Pay
```
Net Pay = Gross Pay - Total Deductions
```

## Project Structure

```
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Seed data
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── dashboard/     # Dashboard pages
│   │   └── login/         # Login page
│   ├── components/
│   │   ├── layout/        # Layout components
│   │   └── ui/            # UI components (shadcn)
│   ├── hooks/             # Custom hooks
│   ├── lib/
│   │   ├── auth.ts        # Authentication utilities
│   │   ├── excel-parser.ts # Excel parsing
│   │   ├── payroll-calculator.ts # Payroll calculations
│   │   ├── prisma.ts      # Prisma client
│   │   └── utils.ts       # Utility functions
│   └── stores/            # Zustand stores
├── .env.example           # Environment template
├── package.json
└── README.md
```

## Database Schema

### Main Tables
- `users` - User accounts with roles
- `employees` - Employee master data
- `payroll_runs` - Payroll run per cutoff
- `timesheet_entries` - Raw imported attendance
- `payslips` - Generated payslips
- `payslip_earnings` - Earnings line items
- `payslip_deductions` - Deduction line items
- `audit_logs` - Audit trail for changes
- `settings` - System configuration

## Testing

Run unit tests:
```bash
npm test
```

Tests cover:
- Workday calculations (excluding Sundays)
- Cutoff period detection (16-30, 16-31, etc.)
- Government deduction rules (1-15 vs 16-end)

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Employees
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `GET /api/employees/:id` - Get employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Payroll Runs
- `GET /api/payroll-runs` - List payroll runs
- `POST /api/payroll-runs` - Create payroll run
- `GET /api/payroll-runs/:id` - Get payroll run with payslips
- `PUT /api/payroll-runs/:id` - Update/finalize payroll run
- `DELETE /api/payroll-runs/:id` - Delete payroll run

### Payslips
- `GET /api/payslips` - List payslips
- `GET /api/payslips/:id` - Get payslip details
- `PUT /api/payslips/:id/kpi` - Update KPI
- `GET /api/payslips/:id/pdf` - Download PDF

### Import
- `POST /api/import/parse` - Parse Excel file
- `POST /api/import/process` - Validate import
- `PUT /api/import/process` - Execute import

### Reports
- `GET /api/reports/payroll-summary` - Get summary report
- `GET /api/reports/payroll-summary/export` - Export CSV

## Deployment

### Environment Variables

```env
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key

# Optional
NEXT_PUBLIC_APP_NAME="Payroll System"
NEXT_PUBLIC_COMPANY_NAME="Your Company"
```

### Build for Production

```bash
npm run build
npm start
```

### Docker (Optional)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Security Considerations

- Passwords hashed with bcrypt
- JWT tokens with expiration
- Role-based API route protection
- Server-side validation with Zod
- Audit logging for sensitive changes

## License

MIT License
