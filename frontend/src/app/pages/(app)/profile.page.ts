import { RouteMeta } from '@analogjs/router';
import { accessGuard } from '../../core/auth/access.guard';
import { ProfileModal } from '../../features/profile/profile-modal/profile-modal';

export const routeMeta = {
	title: 'Профиль - Система Заявок Студентов',
	canActivate: [accessGuard],
} satisfies RouteMeta;

export default ProfileModal;
