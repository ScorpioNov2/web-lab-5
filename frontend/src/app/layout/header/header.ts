import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ROLE_LABELS } from '../../core/auth/roles';
import { AuthModalMode, AuthModalService } from '../../features/auth/auth-modal.service';
import { AlertService } from '../../shared/ui/alert/alert.service';

/** Top bar: title, the profile icon and the login / registration / logout buttons. */
@Component({
	selector: 'app-header',
	imports: [RouterLink],
	templateUrl: './header.html',
	styleUrl: './header.scss',
})
export class Header {
	protected readonly auth = inject(AuthService);
	private readonly authModal = inject(AuthModalService);
	private readonly alert = inject(AlertService);
	private readonly router = inject(Router);

	/** Tooltip of the profile icon: who is signed in. */
	protected readonly profileTitle = computed(() => {
		const user = this.auth.currentUser();
		const role = this.auth.role();
		const name = user?.fullName || user?.username;
		return [name, role ? ROLE_LABELS[role] : null].filter(Boolean).join(' · ') || 'Профиль';
	});

	protected openAuth(mode: AuthModalMode, event: Event): void {
		// Do not let the click reach the document: it would drop the table row selection.
		event.stopPropagation();
		this.authModal.open(mode);
	}

	protected async logout(): Promise<void> {
		this.auth.logout();
		await this.router.navigate(['/login']);
		this.alert.info('Вы вышли из системы.');
	}
}
