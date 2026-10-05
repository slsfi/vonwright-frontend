import { Routes } from '@angular/router';

import { authFeatureEnabledMatchGuard } from '@guards/auth-feature-enabled-match.guard';
import { authGuard } from '@guards/auth.guard';
import { resetPasswordJwtGuard } from '@guards/reset-password-jwt.guard';
import { verifyEmailJwtGuard } from '@guards/verify-email-jwt.guard';

/**
 * Canonical app routes definition.
 *
 * Keep all lazy routes here for development and maintenance.
 * Production builds can replace this file with a generated,
 * feature-filtered variant.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage)
  },
  {
    path: 'about',
    loadChildren: () => import('./pages/about/about.routes').then(m => m.aboutRoutes)
  },
  {
    path: 'cookie-policy',
    data: { backendPageId: '05-01' },
    loadChildren: () => import('./pages/about/about.routes').then(m => m.aboutRoutes)
  },
  {
    path: 'privacy-policy',
    data: { backendPageId: '05-02' },
    loadChildren: () => import('./pages/about/about.routes').then(m => m.aboutRoutes)
  },
  {
    path: 'terms',
    data: { backendPageId: '05-03' },
    loadChildren: () => import('./pages/about/about.routes').then(m => m.aboutRoutes)
  },
  {
    path: 'accessibility-statement',
    data: { backendPageId: '05-04' },
    loadChildren: () => import('./pages/about/about.routes').then(m => m.aboutRoutes)
  },
  {
    path: 'article',
    loadChildren: () => import('./pages/article/article.routes').then(m => m.articleRoutes)
  },
  {
    path: 'content',
    loadComponent: () => import('./pages/content/content.page').then(m => m.ContentPage),
    canActivate: [authGuard]
  },
  {
    path: 'collection/:collectionID/cover',
    loadComponent: () => import('./pages/collection/cover/collection-cover.page').then(m => m.CollectionCoverPage),
    canActivate: [authGuard]
  },
  {
    path: 'collection/:collectionID/title',
    loadComponent: () => import('./pages/collection/title/collection-title.page').then(m => m.CollectionTitlePage),
    canActivate: [authGuard]
  },
  {
    path: 'collection/:collectionID/foreword',
    loadComponent: () => import('./pages/collection/foreword/collection-foreword.page').then(m => m.CollectionForewordPage),
    canActivate: [authGuard]
  },
  {
    path: 'collection/:collectionID/introduction',
    loadComponent: () => import('./pages/collection/introduction/collection-introduction.page').then(m => m.CollectionIntroductionPage),
    canActivate: [authGuard]
  },
  {
    path: 'collection/:collectionID/text',
    loadChildren: () => import('./pages/collection/text/collection-text.routes').then(m => m.collectionTextRoutes),
    canActivate: [authGuard]
  },
  {
    path: 'ebook',
    loadChildren: () => import('./pages/ebook/ebook.routes').then(m => m.ebookRoutes)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [authGuard]
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then(m => m.RegisterPage),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [authGuard]
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage),
    canMatch: [authFeatureEnabledMatchGuard]
  },
  {
    path: 'change-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.page').then(m => m.ForgotPasswordPage),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [authGuard]
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password.page').then(m => m.ResetPasswordPage),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [resetPasswordJwtGuard]
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./pages/verify-email/verify-email.page').then(m => m.VerifyEmailPage),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [verifyEmailJwtGuard]
  },
  {
    path: 'account',
    data: { requiresSessionValidation: true },
    loadComponent: () => import('./pages/account/account.page').then(m => m.AccountPage),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [authGuard]
  },
  {
    path: 'home',
    redirectTo: '',
    pathMatch: 'full'
  },
  {
    path: 'index/:type',
    loadComponent: () => import('./pages/index/index.page').then(m => m.IndexPage),
    canActivate: [authGuard]
  },
  {
    path: 'media-collection',
    loadChildren: () => import('./pages/media-collection/media-collection.routes').then(m => m.mediaCollectionRoutes),
    canActivate: [authGuard]
  },
  {
    path: 'search',
    loadComponent: () => import('./pages/elastic-search/elastic-search.page').then(m => m.ElasticSearchPage),
    canActivate: [authGuard]
  },
  {
    path: '**',
    loadComponent: () => import('./pages/page-not-found/page-not-found.page').then(m => m.PageNotFoundPage)
  }
];
