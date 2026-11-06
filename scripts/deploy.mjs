import ghPages from 'gh-pages';
import { loadEnv } from 'vite';

const environment = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const repository = environment.PUBLIC_PAGES_REPO;
if (!repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) {
  console.error('Укажите PUBLIC_PAGES_REPO=владелец/репозиторий в .env.local. Публикуется только папка dist.');
  process.exitCode = 1;
} else {
  await new Promise((resolve, reject) => ghPages.publish('dist', {
    repo: `git@github.com:${repository}.git`,
    branch: environment.PUBLIC_PAGES_BRANCH || 'main',
    nojekyll: true,
    dotfiles: true,
  }, (error) => error ? reject(error) : resolve()));
  console.log(`Опубликована сборка: https://${repository.split('/')[0]}.github.io/${repository.split('/')[1]}/`);
}
