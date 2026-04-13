import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamPermission } from '@fastgpt/global/support/permission/user/controller';
import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum
} from '@fastgpt/global/support/user/team/constant';
import { getTmbPermission } from '@fastgpt/service/support/permission/controller';
import type { PaginationProps, PaginationResponseType } from '@fastgpt/global/openapi/api';
import type { TeamMemberItemType } from '@fastgpt/global/support/user/team/type';
import { Types } from '@fastgpt/service/common/mongo';
import { MongoGroupMemberModel } from '@fastgpt/service/support/permission/memberGroup/groupMemberSchema';
import { MongoOrgMemberModel } from '@fastgpt/service/support/permission/org/orgMemberSchema';
import { TeamDefaultRoleVal } from '@fastgpt/global/support/permission/user/constant';

type ReqBody = PaginationProps<{
  status?: `${TeamMemberStatusEnum}` | 'active' | 'inactive' | 'all';
  withOrgs?: boolean;
  withPermission?: boolean;
  searchKey?: string;
  orgId?: string;
  groupId?: string;
}>;

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });
  const {
    pageSize,
    offset,
    pageNum,
    status = TeamMemberStatusEnum.active,
    withOrgs = true,
    withPermission = true,
    searchKey,
    orgId,
    groupId
  } = req.body;

  const limit = Math.min(Number(pageSize || 20), 100);
  const skip =
    offset !== undefined ? Number(offset) : Math.max(Number(pageNum || 1) - 1, 0) * limit;

  const teamObjectId = new Types.ObjectId(String(teamId));

  const filterTmbIdSet = async () => {
    const sets: Set<string>[] = [];
    if (groupId) {
      const groupMembers = await MongoGroupMemberModel.find(
        { groupId: new Types.ObjectId(String(groupId)) },
        'tmbId'
      ).lean();
      sets.push(new Set(groupMembers.map((m) => String(m.tmbId))));
    }
    if (orgId) {
      const orgMembers = await MongoOrgMemberModel.find(
        { teamId: teamObjectId, orgId: new Types.ObjectId(String(orgId)) },
        'tmbId'
      ).lean();
      sets.push(new Set(orgMembers.map((m) => String(m.tmbId))));
    }

    if (sets.length === 0) return undefined;
    const merged = sets.reduce(
      (acc, s) => {
        if (!acc) return new Set(s);
        return new Set([...acc].filter((x) => s.has(x)));
      },
      undefined as undefined | Set<string>
    );
    return merged ? Array.from(merged) : [];
  };

  const tmbIds = await filterTmbIdSet();
  const normalizedStatus =
    status === ('inactive' as any) ? TeamMemberStatusEnum.forbidden : (status as any);

  const match: Record<string, any> = {
    teamId: teamObjectId,
    ...(tmbIds ? { _id: { $in: tmbIds.map((id) => new Types.ObjectId(id)) } } : {})
  };
  if (normalizedStatus !== 'all') {
    match.status = normalizedStatus as any;
  }

  const reg = searchKey ? new RegExp(searchKey, 'i') : undefined;

  // Join user info for searchKey and contact
  const basePipeline: any[] = [
    { $match: match },
    {
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
  ];

  if (reg) {
    basePipeline.push({
      $match: {
        $or: [{ name: reg }, { 'user.username': reg }, { 'user.contact': reg }]
      }
    });
  }

  const [totalResult, listResult] = await Promise.all([
    MongoTeamMember.aggregate([...basePipeline, { $count: 'total' }]),
    MongoTeamMember.aggregate([
      ...basePipeline,
      { $sort: { createTime: -1 } },
      { $skip: skip },
      { $limit: limit }
    ])
  ]);

  const total = totalResult?.[0]?.total || 0;

  const list: TeamMemberItemType[] = await Promise.all(
    listResult.map(async (item: any) => {
      const tmbId = String(item._id);
      const role = (item.role as string) || 'member';

      const permission = withPermission
        ? new TeamPermission({
            role:
              (await getTmbPermission({ resourceType: 'team', teamId: String(teamId), tmbId })) ??
              TeamDefaultRoleVal,
            isOwner: role === TeamMemberRoleEnum.owner
          })
        : undefined;

      return {
        userId: String(item.userId),
        username: item.user?.username,
        userStatus: item.user?.status,
        tmbId,
        teamId: String(teamId),
        memberName: item.name,
        avatar: item.avatar,
        role: role as any,
        status: item.status,
        contact: item.user?.contact,
        createTime: item.createTime,
        updateTime: item.updateTime,
        ...(withPermission ? { permission } : {}),
        ...(withOrgs ? { orgs: [] } : {})
      } as any;
    })
  );

  const data: PaginationResponseType<TeamMemberItemType> = {
    total,
    list
  };

  return data;
}

export default NextAPI(handler);
