import { useState } from "react";
import { ArrowRight, Users, X, Award, Briefcase, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { iTeamMember } from "./retro-team-carousel";

interface MentorBlogProps {
  tagline?: string;
  heading?: string;
  description?: string;
  mentors: iTeamMember[];
}

export function MentorBlog({
  tagline,
  heading,
  description,
  mentors = [],
}: MentorBlogProps) {
  const [selectedMentor, setSelectedMentor] = useState<iTeamMember | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleViewProfile = (mentor: iTeamMember) => {
    setSelectedMentor(mentor);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setSelectedMentor(null);
  };

  return (
    <>
      <section className="pt-8 md:pt-12 pb-12 md:pb-16 bg-[#FAF7F3] relative z-10">
        <div className="container mx-auto flex flex-col items-center gap-16 lg:px-16 px-4">
          {(tagline || heading || description) && (
            <div className="text-center">
              {tagline && (
                <Badge variant="secondary" className="mb-6 bg-red-600 text-white border-red-500">
                  {tagline}
                </Badge>
              )}
              {heading && (
                <h2 className="mb-3 text-pretty text-3xl font-semibold md:mb-4 md:text-4xl lg:mb-6 lg:max-w-3xl lg:text-5xl text-gray-900">
                  {heading}
                </h2>
              )}
              {description && (
                <p className="mb-8 text-gray-700 md:text-base lg:max-w-2xl lg:text-lg mx-auto">
                  {description}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8 w-full">
            {mentors.map((mentor) => (
              <Card 
                key={mentor.name} 
                className="grid grid-rows-[auto_auto_1fr_auto] bg-gradient-to-br from-[#FAF7F3] via-[#FEFBF8] to-white border-2 border-[#E3D9CC] hover:shadow-xl transition-all duration-300 hover:scale-105"
              >
                <CardHeader className="flex flex-col items-center pt-4 pb-3">
                  {/* Profile Image - Circular */}
                  <div className="w-32 h-32 md:w-36 md:h-36 rounded-full overflow-hidden bg-gradient-to-br from-[#E3D9CC] to-[#F5E6D3] flex items-center justify-center relative border-2 border-[#E3D9CC] shadow-md mb-3">
                    {mentor.profileImage && mentor.profileImage.trim() !== "" ? (
                      <img
                        src={mentor.profileImage}
                        alt={mentor.name}
                        className="w-full h-full object-cover object-center"
                        style={{ imageRendering: 'auto' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : null}
                    {(!mentor.profileImage || mentor.profileImage.trim() === "") && (
                      <Users className="w-16 h-16 md:w-20 md:h-20 text-red-600 z-10" />
                    )}
                  </div>
                  <div className="flex items-center justify-between mb-2 w-full">
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                      {mentor.specialist}
                    </Badge>
                    <span className="text-xs text-gray-600 font-medium">
                      {mentor.yearsOfExperience} years
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 md:text-xl text-center">
                    {mentor.name}
                  </h3>
                  <p className="text-sm text-red-600 font-medium mt-1 text-center">
                    {mentor.designation}
                  </p>
                </CardHeader>

                <CardContent>
                  <p className="text-gray-700 text-sm leading-relaxed line-clamp-3">
                    {mentor.description}
                  </p>
                  {/* Expertise Tags */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {mentor.expertise.slice(0, 3).map((exp, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-xs bg-white border-[#E3D9CC] text-gray-700"
                      >
                        {exp}
                      </Badge>
                    ))}
                    {mentor.expertise.length > 3 && (
                      <Badge
                        variant="outline"
                        className="text-xs bg-white border-[#E3D9CC] text-gray-700"
                      >
                        +{mentor.expertise.length - 3} more
                      </Badge>
                    )}
                  </div>
                </CardContent>

                <CardFooter>
                  <button
                    className="flex items-center text-red-600 hover:text-red-700 hover:underline font-medium text-sm transition-colors"
                    onClick={() => handleViewProfile(mentor)}
                  >
                    View Profile
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Mentor Profile Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedMentor && (
            <>
              <DialogHeader>
                <DialogTitle className="text-fluid-h3 font-bold text-gray-900">
                  {selectedMentor.name}
                </DialogTitle>
                <DialogDescription className="text-base text-red-600 font-medium">
                  {selectedMentor.designation}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Profile Image */}
                <div className="flex justify-center">
                  <div className="w-48 h-48 md:w-64 md:h-64 rounded-full overflow-hidden bg-gradient-to-br from-[#E3D9CC] to-[#F5E6D3] flex items-center justify-center relative border-4 border-[#E3D9CC] shadow-lg">
                    {selectedMentor.profileImage && selectedMentor.profileImage.trim() !== "" ? (
                      <img
                        src={selectedMentor.profileImage}
                        alt={selectedMentor.name}
                        className="w-full h-full object-cover object-center"
                        style={{ imageRendering: 'auto' }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Users className="w-24 h-24 md:w-32 md:h-32 text-red-600" />
                    )}
                  </div>
                </div>

                {/* Key Information */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-[#FAF7F3] to-white rounded-lg border border-[#E3D9CC]">
                    <div className="p-2 bg-red-100 rounded-full">
                      <Calendar className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Experience</p>
                      <p className="text-lg font-semibold text-gray-900">{selectedMentor.yearsOfExperience} Years</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-[#FAF7F3] to-white rounded-lg border border-[#E3D9CC]">
                    <div className="p-2 bg-red-100 rounded-full">
                      <Award className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Specialist</p>
                      <p className="text-lg font-semibold text-gray-900">{selectedMentor.specialist}</p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="p-6 bg-gradient-to-br from-[#FAF7F3] via-[#FEFBF8] to-white rounded-lg border border-[#E3D9CC]">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-red-600" />
                    About
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    {selectedMentor.description}
                  </p>
                </div>

                {/* Expertise */}
                <div className="p-6 bg-gradient-to-br from-[#FAF7F3] via-[#FEFBF8] to-white rounded-lg border border-[#E3D9CC]">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-red-600" />
                    Areas of Expertise
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedMentor.expertise.map((exp, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-sm bg-white border-red-200 text-red-700 px-3 py-1"
                      >
                        {exp}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

