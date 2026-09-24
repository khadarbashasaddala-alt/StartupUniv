import "dotenv/config";
import { db } from "../db";
import { mentorJobPostings } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seedMentorJobPostings() {
  try {
    console.log("🌱 Seeding mentor job postings...\n");

    // Check if job postings already exist
    const existing = await db.select().from(mentorJobPostings).limit(1);
    if (existing.length > 0) {
      console.log("ℹ️  Mentor job postings already exist. Skipping seed.");
      process.exit(0);
    }

    const jobPostings = [
      {
        title: "Mentor - AI/ML & Data Science",
        description: `We are looking for experienced mentors in AI/ML and Data Science to guide our students in building innovative solutions. As a mentor, you will:

• Provide technical guidance and mentorship to student teams
• Review code, architecture, and technical decisions
• Conduct regular check-ins and provide feedback
• Help students navigate challenges in AI/ML projects
• Participate in project reviews and assessments
• Assist in founder-matching and team formation

Requirements:
• Minimum 5+ years of experience in AI/ML or Data Science
• Strong background in machine learning, deep learning, or data analytics
• Experience mentoring or teaching is preferred
• Excellent communication skills
• Passionate about helping students succeed

This is a rewarding opportunity to shape the next generation of tech entrepreneurs while contributing to innovative startup projects.`,
        location: "Bangalore",
        jobType: "HYBRID" as const,
        experienceRequired: "5-10 years",
        areaOfInterest: ["AI / Machine Learning", "Data Science & Analytics"],
        requiredSkills: [
          "Machine Learning",
          "Deep Learning",
          "Python",
          "TensorFlow/PyTorch",
          "Data Analysis",
        ],
        isActive: true,
      },
      {
        title: "Mentor - Full-Stack Development & Cloud",
        description: `Join us as a Full-Stack Development and Cloud mentor to help students build scalable web applications and cloud-native solutions. Your role will include:

• Mentoring student teams on full-stack development best practices
• Providing guidance on cloud architecture and DevOps
• Code reviews and technical feedback sessions
• Helping students with system design and scalability challenges
• Conducting technical workshops and sessions
• Participating in sprint reviews and project assessments

Requirements:
• Minimum 5+ years of experience in full-stack development
• Strong expertise in modern web technologies (React, Node.js, etc.)
• Experience with cloud platforms (AWS, Azure, or GCP)
• Knowledge of DevOps practices and CI/CD
• Previous mentoring or teaching experience preferred
• Strong problem-solving and communication skills

Make a meaningful impact by mentoring aspiring developers and helping them build production-ready applications.`,
        location: "Bangalore",
        jobType: "HYBRID" as const,
        experienceRequired: "5-10 years",
        areaOfInterest: ["Full-Stack Development", "Cloud & DevOps"],
        requiredSkills: [
          "React/Next.js",
          "Node.js",
          "AWS/Cloud",
          "Docker/Kubernetes",
          "CI/CD",
        ],
        isActive: true,
      },
    ];

    for (const posting of jobPostings) {
      await db.insert(mentorJobPostings).values(posting);
      console.log(`✅ Created job posting: ${posting.title}`);
    }

    console.log("\n✅ Mentor job postings seeded successfully!");
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Error seeding mentor job postings:", error);
    process.exit(1);
  }
}

seedMentorJobPostings();

