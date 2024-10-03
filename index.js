import { Octokit } from 'octokit';
import moment from 'moment';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

dotenv.config();

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getPRStatistics(owner, repo) {
  console.log(`Fetching PR statistics for ${owner}/${repo}...`);

  try {
    // First, let's check if we can access the repository
    await octokit.rest.repos.get({ owner, repo });
  } catch (error) {
    if (error.status === 404) {
      console.error(`Repository not found: ${owner}/${repo}`);
      console.error("Please check if the repository exists and if you have the correct permissions.");
      return;
    } else if (error.status === 401) {
      console.error("Authentication failed. Please check your GitHub token.");
      return;
    } else {
      console.error(`Error accessing repository: ${error.message}`);
      return;
    }
  }

  const oneMonthAgo = moment().subtract(1, "month").toISOString();

  let prs;
  try {
    prs = await octokit.paginate(octokit.rest.pulls.list, {
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: 100,
    });
  } catch (error) {
    console.error(`Error fetching pull requests: ${error.message}`);
    return;
  }

  console.log(`Found ${prs.length} closed PRs in total.`);

  const approvedPRs = prs.filter(pr => {
    const createdAt = moment(pr.created_at);
    return createdAt.isAfter(oneMonthAgo) && pr.merged_at;
  });

  console.log(`${approvedPRs.length} PRs were created in the last month and merged.`);

  let totalFirstReviewTime = 0;
  let approvalCounts = {};

  for (const pr of approvedPRs) {
    try {
      const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
        owner,
        repo,
        pull_number: pr.number,
      });

      const approvals = reviews.filter(review => review.state === "APPROVED");

      if (approvals.length > 0) {
        const firstApproval = approvals[0];
        const firstReviewTime = moment(firstApproval.submitted_at).diff(moment(pr.created_at), "hours");
        totalFirstReviewTime += firstReviewTime;

        approvals.forEach(approval => {
          approvalCounts[approval.user.login] = (approvalCounts[approval.user.login] || 0) + 1;
        });
      }
    } catch (error) {
      console.error(`Error fetching reviews for PR #${pr.number}: ${error.message}`);
    }
  }

  const averageFirstReviewTime = totalFirstReviewTime / approvedPRs.length;

  console.log(`\nStatistics:`);
  console.log(`Number of approved PRs in the last month: ${approvedPRs.length}`);
  console.log(`Average first review time: ${averageFirstReviewTime.toFixed(2)} hours`);
  console.log("\nApproval counts by reviewer:");
  Object.entries(approvalCounts).forEach(([reviewer, count]) => {
    console.log(`${reviewer}: ${count}`);
  });
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const [owner, repo] = args;

if (!owner || !repo) {
  console.error("Please provide the owner and repository name as command line arguments.");
  process.exit(1);
}

getPRStatistics(owner, repo).catch(error => {
  console.error("An unexpected error occurred:", error);
});