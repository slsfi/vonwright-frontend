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
    loadChildren: () => import('./pages/home/home.module').then(m => m.HomePageModule)
  },
  {
    path: 'about',
    loadChildren: () => import('./pages/about/about.module').then(m => m.AboutPageModule)
  },
  {
    path: 'cookie-policy',
    data: { backendPageId: '05-01' },
    loadChildren: () => import('./pages/about/about.module').then(m => m.AboutPageModule)
  },
  {
    path: 'privacy-policy',
    data: { backendPageId: '05-02' },
    loadChildren: () => import('./pages/about/about.module').then(m => m.AboutPageModule)
  },
  {
    path: 'terms',
    data: { backendPageId: '05-03' },
    loadChildren: () => import('./pages/about/about.module').then(m => m.AboutPageModule)
  },
  {
    path: 'accessibility-statement',
    data: { backendPageId: '05-04' },
    loadChildren: () => import('./pages/about/about.module').then(m => m.AboutPageModule)
  },
  {
    path: 'article',
    loadChildren: () => import('./pages/article/article.module').then(m => m.ArticlePageModule)
  },
  {
    path: 'content',
    loadChildren: () => import('./pages/content/content.module').then(m => m.ContentPageModule)
  },
  {
    path: 'collection/:collectionID/cover',
    loadChildren: () => import('./pages/collection/cover/collection-cover.module').then(m => m.CollectionCoverPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'collection/:collectionID/title',
    loadChildren: () => import('./pages/collection/title/collection-title.module').then(m => m.CollectionTitlePageModule),
    canActivate: [authGuard]
  },
  {
    path: 'collection/:collectionID/foreword',
    loadChildren: () => import('./pages/collection/foreword/collection-foreword.module').then(m => m.CollectionForewordPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'collection/:collectionID/introduction',
    loadChildren: () => import('./pages/collection/introduction/collection-introduction.module').then(m => m.CollectionIntroductionPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'collection/:collectionID/text',
    loadChildren: () => import('./pages/collection/text/collection-text.module').then(m => m.CollectionTextPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'ebook',
    loadChildren: () => import('./pages/ebook/ebook.module').then(m => m.EbookPageModule)
  },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [authGuard]
  },
  {
    path: 'register',
    loadChildren: () => import('./pages/register/register.module').then(m => m.RegisterPageModule),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [authGuard]
  },
  {
    path: 'forgot-password',
    loadChildren: () => import('./pages/forgot-password/forgot-password.module').then(m => m.ForgotPasswordPageModule),
    canMatch: [authFeatureEnabledMatchGuard]
  },
  {
    path: 'change-password',
    loadChildren: () => import('./pages/forgot-password/forgot-password.module').then(m => m.ForgotPasswordPageModule),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [authGuard]
  },
  {
    path: 'reset-password',
    loadChildren: () => import('./pages/reset-password/reset-password.module').then(m => m.ResetPasswordPageModule),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [resetPasswordJwtGuard]
  },
  {
    path: 'verify-email',
    loadChildren: () => import('./pages/verify-email/verify-email.module').then(m => m.VerifyEmailPageModule),
    canMatch: [authFeatureEnabledMatchGuard],
    canActivate: [verifyEmailJwtGuard]
  },
  {
    path: 'account',
    data: { requiresSessionValidation: true },
    loadChildren: () => import('./pages/account/account.module').then(m => m.AccountPageModule),
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
    loadChildren: () => import('./pages/index/index.module').then(m => m.IndexPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'media-collection',
    loadChildren: () => import('./pages/media-collection/media-collection.module').then(m => m.MediaCollectionPageModule),
    canActivate: [authGuard]
  },
  {
    path: 'search',
    loadChildren: () => import('./pages/elastic-search/elastic-search.module').then(m => m.ElasticSearchPageModule),
    canActivate: [authGuard]
  },
  {
    path: '**',
    loadChildren: () => import('./pages/page-not-found/page-not-found.module').then(m => m.PageNotFoundPageModule)
  }
];
