import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ROLE_LABELS } from '../../../core/auth/roles';
import { ModalShell } from '../../../shared/ui/modal-shell/modal-shell';

/**
 * /profile: who is signed in and what they may do, as a popup on top of the table. The data is
 * the `user` the backend returned at the last login / token refresh (the backend has no
 * "current user" endpoint).
 */
@Component({
	selector: 'app-profile-modal',
	imports: [ModalShell],
	templateUrl: './profile-modal.html',
	styleUrl: './profile-modal.scss',
})
export class ProfileModal {
	protected readonly auth = inject(AuthService);
	private readonly router = inject(Router);

	protected readonly user = this.auth.currentUser;
	protected readonly roleLabel = computed(() => {
		const role = this.auth.role();
		return role ? ROLE_LABELS[role] : '—';
	});

	protected close(): void {
		void this.router.navigate(['/students'], { queryParamsHandling: 'preserve' });
	}
}
