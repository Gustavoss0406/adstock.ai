import { prisma } from "../src/lib/prisma"
import { createDefaultAgents, createDefaultChannels, createAgencyEvent } from "../src/lib/agents/controller"

async function main() {
  console.log("🌱 Seeding database...")

  // Clean
  await prisma.agencyEvent.deleteMany()
  await prisma.voteDecision.deleteMany()
  await prisma.vote.deleteMany()
  await prisma.messageReaction.deleteMany()
  await prisma.message.deleteMany()
  await prisma.meetingParticipant.deleteMany()
  await prisma.meeting.deleteMany()
  await prisma.task.deleteMany()
  await prisma.sprint.deleteMany()
  await prisma.project.deleteMany()
  await prisma.artwork.deleteMany()
  await prisma.integration.deleteMany()
  await prisma.agentMetric.deleteMany()
  await prisma.agent.deleteMany()
  await prisma.channel.deleteMany()
  await prisma.officeSettings.deleteMany()
  await prisma.onboarding.deleteMany()
  await prisma.organizationMember.deleteMany()
  await prisma.organization.deleteMany()
  await prisma.verificationToken.deleteMany()
  await prisma.session.deleteMany()
  await prisma.account.deleteMany()
  await prisma.user.deleteMany()

  console.log("✅ Database cleaned")
  console.log("✨ Seed complete! Create an account to start.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
