import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Alert, AlertDescription } from "~/components/ui/alert";

type QuestionDraft = {
  question: string;
  required: boolean;
};

type QuestionsStepProps = {
  questions: QuestionDraft[];
  onQuestionsChange: (questions: QuestionDraft[]) => void;
  onBack: () => void;
  onSubmit: () => void;
  submitting: boolean;
};

export function QuestionsStep({
  questions,
  onQuestionsChange,
  onBack,
  onSubmit,
  submitting,
}: QuestionsStepProps) {
  return (
    <Card className="rounded-lg">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">RSVP Questions</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add questions that participants will answer when RSVPing. You can skip this step.
            </p>
          </div>

          {questions.map((q, idx) => (
            <div key={idx} className="flex items-start gap-3 border rounded-md p-3">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder={`Question ${idx + 1}`}
                  value={q.question}
                  onChange={(e) => {
                    const updated = [...questions];
                    updated[idx] = { ...updated[idx], question: e.target.value };
                    onQuestionsChange(updated);
                  }}
                />
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={q.required}
                    onCheckedChange={(checked) => {
                      const updated = [...questions];
                      updated[idx] = { ...updated[idx], required: !!checked };
                      onQuestionsChange(updated);
                    }}
                  />
                  <span className="text-sm">Required</span>
                </label>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onQuestionsChange(questions.filter((_, i) => i !== idx))}
              >
                Remove
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => onQuestionsChange([...questions, { question: "", required: false }])}
          >
            + Add Question
          </Button>

          {/* Info callout */}
          <Alert className="border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
            </svg>
            <AlertDescription>
              You can add or edit questions after creating the event as well.
            </AlertDescription>
          </Alert>

          <div className="flex justify-between">
            <Button variant="outline" onClick={onBack} disabled={submitting}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 mr-1">
                <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
              </svg>
              Back
            </Button>
            <Button onClick={onSubmit} disabled={submitting}>
              {submitting ? "Creating..." : "Create Event"}
              {!submitting && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 ml-1">
                  <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                </svg>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
