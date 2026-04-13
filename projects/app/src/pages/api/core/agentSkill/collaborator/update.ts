import { NextAPI } from '@/service/middleware/entry';
import type { ApiRequestProps } from '@fastgpt/service/type/next';
import { authSkill } from '@fastgpt/service/support/permission/agentSkill/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import type { UpdateSkillCollaboratorBody } from '@fastgpt/global/core/agentSkills/collaborator';
import { MongoResourcePermission } from '@fastgpt/service/support/permission/schema';
import { pickCollaboratorIdFields } from '@fastgpt/service/support/permission/utils';

async function handler(req: ApiRequestProps<UpdateSkillCollaboratorBody>) {
  const { skillId, collaborators } = req.body;

  const { teamId } = await authSkill({
    req,
    authToken: true,
    authApiKey: true,
    skillId,
    per: ManagePermissionVal
  });

  if (!Array.isArray(collaborators) || collaborators.length === 0) return;

  await MongoResourcePermission.bulkWrite(
    collaborators.map((clb) => ({
      updateOne: {
        filter: {
          teamId,
          resourceType: 'agentSkill',
          resourceId: skillId,
          ...pickCollaboratorIdFields(clb as any)
        },
        update: {
          $set: {
            teamId,
            resourceType: 'agentSkill',
            resourceId: skillId,
            permission: clb.permission,
            ...pickCollaboratorIdFields(clb as any)
          }
        },
        upsert: true
      }
    }))
  );
}

export default NextAPI(handler);
