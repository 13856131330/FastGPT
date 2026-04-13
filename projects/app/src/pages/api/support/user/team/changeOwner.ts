import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoTeam } from '@fastgpt/service/support/user/team/teamSchema';
import { MongoTeamMember } from '@fastgpt/service/support/user/team/teamMemberSchema';
import { TeamMemberRoleEnum } from '@fastgpt/global/support/user/team/constant';
import { Types } from '@fastgpt/service/common/mongo';
import { mongoSessionRun } from '@fastgpt/service/common/mongo/sessionRun';

type ReqBody = {
  userId: string;
};

async function handler(req: ApiRequestProps<ReqBody>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { userId } = req.body;

  await mongoSessionRun(async (session) => {
    const teamObjectId = new Types.ObjectId(String(teamId));
    const newOwnerUserId = new Types.ObjectId(String(userId));

    const newOwnerTmb = await MongoTeamMember.findOne(
      {
        teamId: teamObjectId,
        userId: newOwnerUserId
      },
      undefined,
      { session }
    );
    if (!newOwnerTmb) return;

    await MongoTeam.updateOne(
      { _id: teamObjectId },
      {
        $set: {
          ownerId: newOwnerUserId
        }
      },
      { session }
    );

    await MongoTeamMember.updateMany(
      { teamId: teamObjectId, role: TeamMemberRoleEnum.owner },
      { $set: { role: 'member' } },
      { session }
    );
    await MongoTeamMember.updateOne(
      { _id: newOwnerTmb._id },
      { $set: { role: TeamMemberRoleEnum.owner } },
      { session }
    );
  });
}

export default NextAPI(handler);
