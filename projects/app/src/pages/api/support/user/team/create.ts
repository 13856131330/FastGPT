import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { MongoMemberGroupModel } from '@fastgpt/service/support/permission/memberGroup/memberGroupSchema';
import { DefaultGroupName } from '@fastgpt/global/support/user/team/group/constant';
import {
  TeamMemberRoleEnum,
  TeamMemberStatusEnum
} from '@fastgpt/global/support/user/team/constant';
import type { CreateTeamProps } from '@fastgpt/global/support/user/team/controller';
import { createRootOrg } from '@fastgpt/service/support/permission/org/controllers';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';

async function handler(req: ApiRequestProps<CreateTeamProps>, res: ApiResponseType<any>) {
  const { userId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { name, avatar, memberName, memberAvatar, notificationAccount, meta } = req.body;

  const teamId = await mongoSessionRun(async (session) => {
    const [{ _id: teamId }] = await MongoTeam.create(
      [
        {
          ownerId: userId,
          name,
          avatar,
          notificationAccount,
          meta,
          createTime: new Date()
        }
      ],
      { session }
    );

    const [tmb] = await MongoTeamMember.create(
      [
        {
          teamId,
          userId,
          name: memberName || 'Owner',
          avatar: memberAvatar,
          role: TeamMemberRoleEnum.owner,
          status: TeamMemberStatusEnum.active,
          createTime: new Date()
        }
      ],
      { session }
    );

    await MongoMemberGroupModel.create(
      [
        {
          teamId,
          name: DefaultGroupName,
          avatar: avatar
        }
      ],
      { session }
    );
    await createRootOrg({ teamId: teamId as any, session });

    return String(teamId);
  });

  return teamId;
}

export default NextAPI(handler);
