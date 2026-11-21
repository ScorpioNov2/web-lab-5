import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthModalMode, AuthModalService } from '../auth-modal.service';

/**
 * /login and /register: what a signed-out visitor sees. It is the student screen of the old
 * version as a guest saw it (empty table, "Вы можете Войти, чтобы просмотреть данные") and the
 * login / registration popup opens on top of it. Closing the popup leaves the page as it was.
 */
@Component({
	selector: 'app-guest-page',
	templateUrl: './guest-page.html',
	// the same look as the student screen
	styleUrl: '../../students/students-page/students-page.scss',
})
export class GuestPage {
	protected readonly authModal = inject(AuthModalService);

	constructor() {
		const mode: AuthModalMode =
			inject(ActivatedRoute).snapshot.data['mode'] === 'register' ? 'register' : 'login';
		this.authModal.open(mode);
	}
}
