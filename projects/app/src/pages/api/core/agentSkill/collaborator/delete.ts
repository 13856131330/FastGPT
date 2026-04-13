import { NextAPI } from '@/service/middleware/entry';
import type { ApiRequestProps } from '@fastgpt/service/type/next';
import { authSkill } from '@fastgpt/service/support/permission/agentSkill/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import type { SkillCollaboratorDeleteParams } from '@fastgpt/global/core/agentSkills/collaborator';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { pickCollaboratorIdFields } from '@fastgpt/service/support/permission/utils';

async function handler(req: ApiRequestProps<{}, SkillCollaboratorDeleteParams>) {
  const { skillId, ...clb } = req.query;

  const { teamId } = await authSkill({
    req,
    authToken: true,
    authApiKey: true,
    skillId,
    per: ManagePermissionVal
  });

  await MongoResourcePermission.deleteOne({
    teamId,
    resourceType: 'agentSkill',
    resourceId: skillId,
    ...pickCollaboratorIdFields(clb as any)
  });
}

export default NextAPI(handler);
