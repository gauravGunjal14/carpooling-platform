import { Router } from 'express';
import {
    listSubmissionsController,
    ownVerificationController,
    reviewSubmissionController,
    submissionDocumentController,
    submissionSummaryController,
    submitDocumentController,
    uploadDocument,
} from '../controllers/verificationController.js';
import { authenticate, authorize } from '../middleware/authenticate.js';

const router = Router();

router.use(authenticate);
router.get('/me', ownVerificationController);
router.post(
    '/documents',
    authorize('Driver', 'Passenger'),
    uploadDocument,
    submitDocumentController,
);
router.get('/admin/summary', authorize('Admin'), submissionSummaryController);
router.get('/admin/submissions', authorize('Admin'), listSubmissionsController);
router.get(
    '/admin/submissions/:id/document',
    authorize('Admin'),
    submissionDocumentController,
);
router.patch('/admin/submissions/:id', authorize('Admin'), reviewSubmissionController);

export default router;
