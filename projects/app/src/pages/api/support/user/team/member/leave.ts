import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ReadPermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberStatusEnum } from '@fastgpt/global/support/user/team/constant';
import { Types } from '@fastgpt/service/common/mongo';

async function handler(req: ApiRequestProps, res: ApiResponseType<any>) {
  const { teamId, tmbId } = await authUserPer({ req, authToken: true, per: ReadPermissionVal });

  await MongoTeamMember.updateOne(
    {
      _id: new Types.ObjectId(String(tmbId)),
      teamId: new Types.ObjectId(String(teamId))
    },
    {
      $set: {
        status: TeamMemberStatusEnum.leave,
        updateTime: new Date()
      }
    }
  );
}

export default NextAPI(handler);
