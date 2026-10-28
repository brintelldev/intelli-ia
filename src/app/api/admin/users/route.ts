import { headers } from 'next/headers';
import { requireRole } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { CreateUserBody } from '@/lib/admin/config-core';
import { SAFE_USER } from '@/lib/admin/users';
import { auditChanges } from '@/lib/admin/audit';
import { adminError } from '@/lib/admin/response';
import { HttpError } from '@/lib/http-error';
import { isRole } from '@/lib/rbac';
import type { Prisma } from '@/generated/prisma/client';

export async function GET(req: Request) {
  try {
    await requireRole(['Admin']);
    const query = new URL(req.url).searchParams;
    const page = Math.max(1, Math.min(10000, Math.floor(Number(query.get('page')) || 1)));
    const limit = 20;
    const search = (query.get('search') ?? '').slice(0, 150);
    const role = query.get('role');
    const status = query.get('status');
    if (role && !isRole(role)) throw new HttpError(400, 'Perfil inválido.');
    if (status && !['active', 'inactive'].includes(status)) throw new HttpError(400, 'Status inválido.');

    // O plugin aceita um filtro por vez. Prisma mantém paginação/total de filtros compostos.
    if (role && status) {
      const where: Prisma.UserWhereInput = {
        role,
        ...(status === 'inactive' ? { banned: true } : { OR: [{ banned: false }, { banned: null }] }),
        ...(search ? { AND: [{ OR: [{ name: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] }] } : {}),
      };
      const [items, total] = await Promise.all([
        prisma.user.findMany({ where, select: SAFE_USER, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
        prisma.user.count({ where }),
      ]);
      return Response.json({ items, total, page, limit });
    }
    const result = await auth.api.listUsers({
      headers: await headers(),
      query: {
        limit, offset: (page - 1) * limit, sortBy: 'createdAt', sortDirection: 'desc',
        ...(search ? { searchField: search.includes('@') ? 'email' as const : 'name' as const, searchValue: search, searchOperator: 'contains' as const } : {}),
        ...(role ? { filterField: 'role', filterValue: role, filterOperator: 'eq' as const } : status ? { filterField: 'banned', filterValue: status === 'inactive', filterOperator: 'eq' as const } : {}),
      },
    });
    const rows = await prisma.user.findMany({ where: { id: { in: result.users.map(user => user.id) } }, select: SAFE_USER });
    return Response.json({ items: result.users.flatMap(user => rows.find(row => row.id === user.id) ?? []), total: result.total, page, limit });
  } catch (error) { return adminError(error); }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole(['Admin']);
    const parsed = CreateUserBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    if (await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } })) throw new HttpError(409, 'Já existe um usuário com este e-mail.');
    const { name, email, password, role, modelOverride, costLimitDay } = parsed.data;
    const result = await auth.api.createUser({
      headers: await headers(), body: { name, email, password, role, data: { modelOverride: modelOverride ?? null, costLimitDay: costLimitDay ?? null } },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.user.id }, select: SAFE_USER });
    auditChanges('user_created', session.user.id, user.id, {}, { name, email, role, modelOverride: user.modelOverride, costLimitDay: user.costLimitDay });
    return Response.json(user, { status: 201 });
  } catch (error) { return adminError(error); }
}
