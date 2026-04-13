import type {
  UpdateSkillCollaboratorBody,
  SkillCollaboratorDeleteParams
} from '@fastgpt/global/core/agentSkills/collaborator';
import { DELETE, GET, POST } from '@/web/common/api/request';
import type { CollaboratorListType } from '@fastgpt/global/support/permission/collaborator';

export const getSkillCollaboratorList = (skillId: string) =>
  GET<CollaboratorListType>('/core/agentSkill/collaborator/list', { skillId });

export const postUpdateSkillCollaborators = (body: UpdateSkillCollaboratorBody) =>
  POST('/core/agentSkill/collaborator/update', body);

export const deleteSkillCollaborator = (params: SkillCollaboratorDeleteParams) =>
  DELETE('/core/agentSkill/collaborator/delete', params);
