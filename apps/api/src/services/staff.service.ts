import { eq, and, inArray, ilike, or } from 'drizzle-orm';
import { db, sql, withSystemContext, withTenant, users, operators, operatorMembers, bookings, buses } from '@ruralbus/database';
import { hashPassword } from './password.service.js';
import { getDevelopmentPassword } from './otp.service.js';
import { sendAccountProvisioningSms, type AccountProvisioningSmsResult } from './sms.service.js';
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
  ForbiddenError,
} from '../errors/AppError.js';
import type {
  StaffMember,
  StaffListResponse,
  CreateStaffInput,
  OperatorProfile,
  UpdateOperatorProfileInput,
  CreateOperatorInput,
  OperatorProvisionResult,
  OperatorDetails,
} from '@ruralbus/shared-types';
import type { StaffQuerySchema } from '@ruralbus/shared-validators';


export async function getOperatorProfile(tenantId: string): Promise<OperatorProfile> {
  const [operator] = await db
    .select()
    .from(operators)
    .where(eq(operators.id, tenantId))
    .limit(1);

  if (!operator) {
    throw new NotFoundError('Operator profile not found');
  }

  return {
    id: operator.id,
    companyName: operator.companyName,
    businessCode: operator.businessCode,
    contactEmail: operator.contactEmail,
    contactPhone: operator.contactPhone,
    status: operator.status,
    createdAt: operator.createdAt.toISOString(),
    updatedAt: operator.updatedAt.toISOString(),
  };
}

export async function updateOperatorProfile(
  tenantId: string,
  input: UpdateOperatorProfileInput
): Promise<OperatorProfile> {
  const updateData: Partial<typeof operators.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.companyName) updateData.companyName = input.companyName;
  if (input.contactEmail) updateData.contactEmail = input.contactEmail;
  if (input.contactPhone) updateData.contactPhone = input.contactPhone;

  const [updated] = await db
    .update(operators)
    .set(updateData)
    .where(eq(operators.id, tenantId))
    .returning();

  if (!updated) {
    throw new NotFoundError('Operator profile not found');
  }

  return {
    id: updated.id,
    companyName: updated.companyName,
    businessCode: updated.businessCode,
    contactEmail: updated.contactEmail,
    contactPhone: updated.contactPhone,
    status: updated.status,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export async function listStaffMembers(
  tenantId: string,
  query?: StaffQuerySchema
): Promise<StaffListResponse> {
  return withSystemContext(async (tx) => {
    // 1. Base join query
    const conditions = [
      eq(operatorMembers.tenantId, tenantId),
      inArray(operatorMembers.role, ['DRIVER', 'CONDUCTOR']),
    ];

    if (query?.role) {
      conditions.push(eq(operatorMembers.role, query.role));
    }

    if (query?.search) {
      const searchPattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(users.fullName, searchPattern),
          ilike(users.phone, searchPattern)
        )!
      );
    }

    const rows = await tx
      .select({
        memberId: operatorMembers.id,
        userId: users.id,
        fullName: users.fullName,
        phone: users.phone,
        email: users.email,
        role: operatorMembers.role,
        isActive: operatorMembers.isActive,
        tenantId: operatorMembers.tenantId,
        createdAt: operatorMembers.createdAt,
        updatedAt: operatorMembers.updatedAt,
      })
      .from(operatorMembers)
      .innerJoin(users, eq(operatorMembers.userId, users.id))
      .where(and(...conditions))
      .orderBy(operatorMembers.createdAt);

    const staff: StaffMember[] = rows.map((r) => ({
      id: r.memberId,
      userId: r.userId,
      fullName: r.fullName,
      phone: r.phone || '',
      email: r.email,
      role: r.role as 'DRIVER' | 'CONDUCTOR',
      isActive: r.isActive,
      tenantId: r.tenantId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    const activeDrivers = staff.filter((s) => s.role === 'DRIVER' && s.isActive).length;
    const activeConductors = staff.filter((s) => s.role === 'CONDUCTOR' && s.isActive).length;

    return {
      staff,
      total: staff.length,
      activeDrivers,
      activeConductors,
    };
  });
}

export async function provisionStaffMember(
  tenantId: string,
  input: CreateStaffInput
): Promise<StaffMember> {
  if (input.role !== 'DRIVER' && input.role !== 'CONDUCTOR') {
    throw new BadRequestError("Only 'DRIVER' or 'CONDUCTOR' roles can be provisioned");
  }

  return withSystemContext(async (tx) => {
    // 1. Verify phone and email uniqueness in users
    const [existingPhone] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, input.phone))
      .limit(1);

    if (existingPhone) {
      throw new ConflictError('A user with this mobile number is already registered');
    }

    if (input.email) {
      const [existingEmail] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);

      if (existingEmail) {
        throw new ConflictError('A user with this email address is already registered');
      }
    }

    // 2. Hash password with Argon2id
    const passwordHash = await hashPassword(input.password);
    const developmentPassword = getDevelopmentPassword(input.password);

    // 3. Insert into users
    const [newUser] = await tx
      .insert(users)
      .values({
        fullName: input.fullName,
        phone: input.phone,
        email: input.email || null,
        passwordHash,
        developmentPassword,
        isActive: true,
        mustChangePassword: true,
        phoneVerified: false,
      })
      .returning();

    // 4. Insert into operator_members
    const [newMember] = await tx
      .insert(operatorMembers)
      .values({
        userId: newUser.id,
        tenantId,
        role: input.role,
        isActive: true,
      })
      .returning();

    // 5. Always send SMS credentials to the new staff member
    const staffResult: StaffMember = {
      id: newMember.id,
      userId: newUser.id,
      fullName: newUser.fullName,
      phone: newUser.phone || '',
      email: newUser.email,
      role: newMember.role as 'DRIVER' | 'CONDUCTOR',
      isActive: newMember.isActive,
      tenantId: newMember.tenantId,
      createdAt: newMember.createdAt.toISOString(),
      updatedAt: newMember.updatedAt.toISOString(),
    };

    // Fire SMS outside the transaction scope (don't fail provision on SMS error)
    setImmediate(async () => {
      try {
        await sendAccountProvisioningSms({
          phone: input.phone,
          fullName: input.fullName,
          role: input.role as 'DRIVER' | 'CONDUCTOR',
          temporaryPassword: input.password,
          operatorName: tenantId, // Will be resolved in SMS service
        });
        console.log(`[Staff] SMS credentials sent to ${input.phone} (${input.role})`);
      } catch (smsErr: any) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[Staff] SMS delivery failed for ${input.phone}: ${smsErr.message}`);
        } else {
          console.error(`[Staff] SMS delivery failed for staff ${input.phone}:`, smsErr.message);
        }
      }
    });

    return staffResult;
  });
}


export async function updateStaffStatus(
  tenantId: string,
  staffId: string,
  isActive: boolean
): Promise<StaffMember> {
  return withSystemContext(async (tx) => {
    // 1. Find member by id & tenantId
    const [member] = await tx
      .select({
        memberId: operatorMembers.id,
        userId: operatorMembers.userId,
        tenantId: operatorMembers.tenantId,
        role: operatorMembers.role,
      })
      .from(operatorMembers)
      .where(and(eq(operatorMembers.id, staffId), eq(operatorMembers.tenantId, tenantId)))
      .limit(1);

    if (!member) {
      const [otherMember] = await tx
        .select({ id: operatorMembers.id })
        .from(operatorMembers)
        .where(eq(operatorMembers.id, staffId))
        .limit(1);

      if (otherMember) {
        throw new ForbiddenError('Cannot modify staff belonging to another operator');
      }
      throw new NotFoundError('Staff member not found in this operator organization');
    }

    // 2. Update status in operator_members
    const [updatedMember] = await tx
      .update(operatorMembers)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(operatorMembers.id, member.memberId))
      .returning();

    // 3. Sync user isActive
    await tx
      .update(users)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(users.id, member.userId));

    // 4. Fetch updated user details
    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, member.userId))
      .limit(1);

    return {
      id: updatedMember.id,
      userId: user.id,
      fullName: user.fullName,
      phone: user.phone || '',
      email: user.email,
      role: updatedMember.role as 'DRIVER' | 'CONDUCTOR',
      isActive: updatedMember.isActive,
      tenantId: updatedMember.tenantId,
      createdAt: updatedMember.createdAt.toISOString(),
      updatedAt: updatedMember.updatedAt.toISOString(),
    };
  });
}

export async function resetStaffPassword(
  tenantId: string,
  staffId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  return withSystemContext(async (tx) => {
    // 1. Find member by id & tenantId
    const [member] = await tx
      .select({
        memberId: operatorMembers.id,
        userId: operatorMembers.userId,
      })
      .from(operatorMembers)
      .where(and(eq(operatorMembers.id, staffId), eq(operatorMembers.tenantId, tenantId)))
      .limit(1);

    if (!member) {
      const [otherMember] = await tx
        .select({ id: operatorMembers.id })
        .from(operatorMembers)
        .where(eq(operatorMembers.id, staffId))
        .limit(1);

      if (otherMember) {
        throw new ForbiddenError('Cannot modify staff belonging to another operator');
      }
      throw new NotFoundError('Staff member not found in this operator organization');
    }

    // 2. Hash new password with Argon2id
    const passwordHash = await hashPassword(newPassword);
    const developmentPassword = getDevelopmentPassword(newPassword);

    // 3. Update user password and flag mustChangePassword
    await tx
      .update(users)
      .set({
        passwordHash,
        developmentPassword,
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, member.userId));

    return {
      success: true,
      message: 'Staff password has been reset successfully',
    };
  });
}

export async function getOperatorRevenueSummary(tenantId: string) {
  return withSystemContext(async (tx) => {
    // 1. Fetch all bookings for this tenant
    const tenantBookings = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.tenantId, tenantId));

    let onlineRevenue = 0;
    let onlineTicketCount = 0;
    let cashRevenue = 0;
    let cashTicketCount = 0;

    for (const b of tenantBookings) {
      if (b.status === 'CONFIRMED' || b.status === 'BOARDED') {
        const isCash = b.paymentId === 'CASH' || (b.paymentId && b.paymentId.startsWith('TKT-'));
        if (isCash) {
          cashRevenue += b.fareAmount;
          cashTicketCount += 1;
        } else {
          onlineRevenue += b.fareAmount;
          onlineTicketCount += 1;
        }
      }
    }

    // 2. Fetch fleet vehicles count
    const tenantBuses = await tx
      .select()
      .from(buses)
      .where(eq(buses.tenantId, tenantId));

    const totalBuses = tenantBuses.length;
    const activeBuses = tenantBuses.filter((b) => b.status === 'ACTIVE').length;

    // 3. Fetch staff members count
    const members = await tx
      .select()
      .from(operatorMembers)
      .where(eq(operatorMembers.tenantId, tenantId));

    return {
      onlineRevenue,
      onlineTicketCount,
      cashRevenue,
      cashTicketCount,
      totalRevenue: onlineRevenue + cashRevenue,
      totalPassengers: onlineTicketCount + cashTicketCount,
      totalBuses,
      activeBuses,
      totalStaff: members.length,
      generatedAt: new Date().toISOString(),
    };
  });
}

/**
 * Creates a new Transport Company (Operator) and Owner account (OPERATOR_ADMIN)
 * in a single atomic database transaction, strictly restricted to PLATFORM_ADMIN.
 *
 * Security & Provisioning Guarantees:
 * 1. Hashes initial password with Argon2id.
 * 2. STRICT ZERO-PLAINTEXT: development_password is set to NULL.
 * 3. must_change_password is set to true.
 * 4. Plaintext password is NEVER returned in the API response or persisted.
 * 5. Dispatches provisioning SMS with honest status reporting (no fake SMS sent).
 * 6. Tenant isolation: Starts with 0 buses, 0 routes, 0 stops, 0 trips, 0 schedules.
 */
export async function createOperatorAndOwner(
  input: CreateOperatorInput
): Promise<OperatorProvisionResult> {
  const companyNameTrimmed = input.companyName.trim();
  const ownerNameTrimmed = input.ownerName.trim();
  const phoneTrimmed = input.phone.trim();
  const emailTrimmed = input.email.trim().toLowerCase();
  const rawPassword = input.password ? input.password.trim() : '';

  if (!rawPassword || rawPassword.length < 8) {
    throw new BadRequestError('Initial password is required and must be at least 8 characters long');
  }

  return withSystemContext(async (tx) => {
    // 1. Check user phone uniqueness
    const [existingPhone] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phone, phoneTrimmed))
      .limit(1);

    if (existingPhone) {
      throw new ConflictError('A user with this mobile number is already registered');
    }

    // 2. Check user email uniqueness
    const [existingEmail] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, emailTrimmed))
      .limit(1);

    if (existingEmail) {
      throw new ConflictError('A user with this email address is already registered');
    }

    // 3. Check operator company name uniqueness
    const [existingCompany] = await tx
      .select({ id: operators.id })
      .from(operators)
      .where(ilike(operators.companyName, companyNameTrimmed))
      .limit(1);

    if (existingCompany) {
      throw new ConflictError('A transport company with this name already exists');
    }

    // 4. Generate or validate unique businessCode
    let baseCode = input.businessCode
      ? input.businessCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
      : companyNameTrimmed.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
    if (!baseCode) baseCode = 'TRANSIT';

    let finalBusinessCode = baseCode;
    let codeAttempts = 0;
    while (codeAttempts < 10) {
      const [existingCode] = await tx
        .select({ id: operators.id })
        .from(operators)
        .where(eq(operators.businessCode, finalBusinessCode))
        .limit(1);

      if (!existingCode) break;
      finalBusinessCode = `${baseCode}-${Math.floor(1000 + Math.random() * 9000)}`;
      codeAttempts++;
    }

    // 5. Hash password strictly with Argon2id
    const passwordHash = await hashPassword(rawPassword);

    // 6. Insert into operators table
    const [newOperator] = await tx
      .insert(operators)
      .values({
        companyName: companyNameTrimmed,
        businessCode: finalBusinessCode,
        contactEmail: emailTrimmed,
        contactPhone: phoneTrimmed,
        status: 'ACTIVE',
      })
      .returning();

    // 7. Insert into users table
    // STRICT SECURITY: developmentPassword is NULL, mustChangePassword is true
    const [newUser] = await tx
      .insert(users)
      .values({
        fullName: ownerNameTrimmed,
        phone: phoneTrimmed,
        email: emailTrimmed,
        passwordHash,
        developmentPassword: null,
        role: 'PASSENGER',
        isActive: true,
        mustChangePassword: true,
        phoneVerified: true,
      })
      .returning();

    // 8. Insert into operator_members table with role = 'OPERATOR_ADMIN'
    await tx
      .insert(operatorMembers)
      .values({
        userId: newUser.id,
        tenantId: newOperator.id,
        role: 'OPERATOR_ADMIN',
        isActive: true,
      })
      .returning();

    // 9. Dispatch SMS with initial credentials
    // Note: rawPassword is in memory solely for delivery to SMS gateway, never logged.
    let smsResult: AccountProvisioningSmsResult;
    try {
      smsResult = await sendAccountProvisioningSms({
        phone: phoneTrimmed,
        transportName: newOperator.companyName,
        ownerName: newUser.fullName,
        username: phoneTrimmed,
        initialPassword: rawPassword,
        accountId: newUser.id,
      });
    } catch (err: any) {
      const digits = phoneTrimmed.replace(/\D/g, '');
      const cleanPhone = digits.length > 10 ? digits.slice(-10) : digits;
      const maskedPhone = `+91 ${cleanPhone.slice(0, 2)}****${cleanPhone.slice(-4)}`;
      smsResult = {
        sent: false,
        provider: 'none',
        maskedPhone,
        message: 'SMS delivery failed',
        error: err?.message || 'Gateway network error',
      };
    }

    // 10. Return result WITHOUT plaintext password or passwordHash
    return {
      operator: {
        id: newOperator.id,
        companyName: newOperator.companyName,
        businessCode: newOperator.businessCode,
        contactEmail: newOperator.contactEmail,
        contactPhone: newOperator.contactPhone,
        status: newOperator.status,
        createdAt: newOperator.createdAt.toISOString(),
      },
      owner: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email || '',
        phone: newUser.phone || '',
        role: 'OPERATOR_ADMIN',
      },
      sms: smsResult,
    };
  });
}

/**
 * Returns all operators along with their associated owner admin details,
 * registered bus count, and staff count.
 */
export async function listOperatorsWithDetails(): Promise<OperatorDetails[]> {
  return withSystemContext(async (tx) => {
    // 1. Fetch all operators
    const allOperators = await tx
      .select()
      .from(operators)
      .orderBy(operators.companyName);

    if (allOperators.length === 0) return [];

    // 2. Fetch all operator admins
    const adminMembers = await tx
      .select({
        tenantId: operatorMembers.tenantId,
        userId: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
      })
      .from(operatorMembers)
      .innerJoin(users, eq(operatorMembers.userId, users.id))
      .where(eq(operatorMembers.role, 'OPERATOR_ADMIN'));

    // 3. Count buses per operator
    const busCounts = await tx
      .select({
        tenantId: buses.tenantId,
        count: sql<number>`count(*)::int`,
      })
      .from(buses)
      .groupBy(buses.tenantId);

    // 4. Count staff per operator
    const staffCounts = await tx
      .select({
        tenantId: operatorMembers.tenantId,
        count: sql<number>`count(*)::int`,
      })
      .from(operatorMembers)
      .groupBy(operatorMembers.tenantId);

    const busCountMap = new Map<string, number>();
    for (const b of busCounts) {
      if (b.tenantId) busCountMap.set(b.tenantId, Number(b.count));
    }

    const staffCountMap = new Map<string, number>();
    for (const s of staffCounts) {
      if (s.tenantId) staffCountMap.set(s.tenantId, Number(s.count));
    }

    const adminMap = new Map<string, typeof adminMembers[0]>();
    for (const a of adminMembers) {
      if (a.tenantId && !adminMap.has(a.tenantId)) {
        adminMap.set(a.tenantId, a);
      }
    }

    return allOperators.map((op) => {
      const admin = adminMap.get(op.id);
      return {
        id: op.id,
        companyName: op.companyName,
        businessCode: op.businessCode,
        contactEmail: op.contactEmail,
        contactPhone: op.contactPhone,
        status: op.status,
        createdAt: op.createdAt.toISOString(),
        updatedAt: op.updatedAt.toISOString(),
        ownerName: admin?.fullName || 'Operator Admin',
        ownerPhone: admin?.phone || op.contactPhone,
        ownerEmail: admin?.email || op.contactEmail,
        busesCount: busCountMap.get(op.id) || 0,
        staffCount: staffCountMap.get(op.id) || (admin ? 1 : 0),
      };
    });
  });
}

