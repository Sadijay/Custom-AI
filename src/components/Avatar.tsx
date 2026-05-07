import React from "react";

export type Expression = "neutral" | "happy" | "thinking" | "surprised" | "apologetic" | "excited" | "sleepy";

interface AvatarProps {
  expression: Expression;
}

const expressionImageMap: Record<Expression, string> = {
  neutral: "/sakura_neutral.png",
  happy: "/sakura_happy.png",
  thinking: "/sakura_thinking.png",
  surprised: "/sakura_happy.png",
  apologetic: "/sakura_neutral.png",
  excited: "/sakura_happy.png",
  sleepy: "/sakura_neutral.png",
};

const Avatar: React.FC<AvatarProps> = ({ expression }) => {
  return (
    <div className="avatar-container">
      <img
        src={expressionImageMap[expression]}
        alt={`Sakura ${expression}`}
        className="avatar-image"
        style={{
          transition: 'opacity 0.3s ease',
          objectFit: 'cover'
        }}
        title={`Expression: ${expression}`}
      />
    </div>
  );
};

export default Avatar;
