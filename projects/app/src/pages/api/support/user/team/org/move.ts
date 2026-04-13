import type { ApiRequestProps, ApiResponseType } from '@fastgpt/service/type/next';
import { NextAPI } from '@/service/middleware/entry';
import { authUserPer } from '@fastgpt/service/support/permission/user/auth';
import { ManagePermissionVal } from '@fastgpt/global/support/permission/constant';
import { MongoOrgModel } from '@fastgpt/service/support/permission/org/orgSchema';
import type { putMoveOrgType } from '@fastgpt/global/support/user/team/org/api';
import { Types } from '@fastgpt/service/common/mongo';
import { getOrgChildrenPath } from '@fastgpt/global/support/user/team/org/constant';

async function handler(req: ApiRequestProps<putMoveOrgType>, res: ApiResponseType<any>) {
  const { teamId } = await authUserPer({ req, authToken: true, per: ManagePermissionVal });
  const { orgId, targetOrgId } = req.body;

  const teamObjectId = new Types.ObjectId(String(teamId));
  const orgObjectId = new Types.ObjectId(String(orgId));

  const org = await MongoOrgModel.findOne({ _id: orgObjectId, teamId: teamObjectId }).lean();
  if (!org) return;

  let newParentPath = '';
  if (targetOrgId) {
    const target = await MongoOrgModel.findOne({
      _id: new Types.ObjectId(String(targetOrgId)),
      teamId: teamObjectId
    }).lean();
    if (target) newParentPath = getOrgChildrenPath(target as any);
  }

  const oldChildrenPath = getOrgChildrenPath(org as any);
  const newSelfPath = newParentPath;
  const newChildrenPath = newSelfPath ? `${newSelfPath}/${org.pathId}` : `/${org.pathId}`;

  // update self
  await MongoOrgModel.updateOne({ _id: orgObjectId }, { $set: { path: newSelfPath } });

  // update descendants paths by prefix replace
  if (oldChildrenPath) {
    const descendants = await MongoOrgModel.find({
      teamId: teamObjectId,
      path: { $regex: new RegExp(`^${oldChildrenPath}`) }
    }).lean();

    if (descendants.length > 0) {
      const bulk = descendants.map((d) => {
        const nextPath = d.path.replace(oldChildrenPath, newChildrenPath);
        return {
          updateOne: {
            filter: { _id: d._id },
            update: { $set: { path: nextPath } }
          }
        };
      });
      await MongoOrgModel.bulkWrite(bulk);
    }
  }
}

export default NextAPI(handler);
