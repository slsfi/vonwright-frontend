import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonicModule } from '@ionic/angular';

type AuthStatusMessageType = 'error' | 'processing' | 'success';


// ─────────────────────────────────────────────────────────────────────────────
// * This component is zoneless-ready. *
// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'auth-status-message',
  templateUrl: './auth-status-message.component.html',
  styleUrls: ['./auth-status-message.component.scss'],
  imports: [IonicModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-live]': 'ariaLive()',
    '[attr.role]': 'role()',
  }
})
export class AuthStatusMessageComponent {
  readonly type = input.required<AuthStatusMessageType>();
  readonly message = input.required<string>();

  readonly iconName = computed(() => {
    const type = this.type();
    return type === 'success'
      ? 'checkmark-circle-sharp'
      : type === 'processing'
      ? 'sync-circle-sharp'
      : 'close-circle-sharp'
  });

  readonly ariaLive = computed(() => this.type() === 'error' ? 'assertive' : 'polite');
  readonly role = computed(() => this.type() === 'error' ? 'alert' : 'status');
}
