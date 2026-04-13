import { NextAPI } from '@/service/middleware/entry';
import type { ApiRequestProps } from '@fastgpt/service/type/next';
import { authSkill } from '@fastgpt/service/support/permission/agentSkill/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import type { CollaboratorListType } from '@fastgpt/global/support/permission/collaborator';
import { getClbsInfo, getResourceOwnedClbs } from '@fastgpt/service/support/permission/controller';

type Query = {
  skillId: string;
};

async function handler(req: ApiRequestProps<Query>): Promise<CollaboratorListType> {
  const { skillId } = req.query;

  const { skill, teamId, tmbId } = await authSkill({
    req,
    authToken: true,
    authApiKey: true,
    skillId,
    per: ReadPermissionVal
  });

  const clbs = await getResourceOwnedClbs({
    resourceType: 'agentSkill',
    teamId,
    resourceId: skillId
  });

  const detail = await getClbsInfo({
    teamId,
    ownerTmbId: String((skill as any).tmbId || tmbId),
    clbs: clbs.map((c) => ({
      ...(c.tmbId ? { tmbId: String(c.tmbId) } : {}),
      ...(c.orgId ? { orgId: String(c.orgId) } : {}),
      ...(c.groupId ? { groupId: String(c.groupId) } : {}),
      permission: c.permission
    })) as any
  });

  return { clbs: detail };
}

export default NextAPI(handler);
