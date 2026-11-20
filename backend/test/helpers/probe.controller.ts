import { Body, Controller, Post } from '@nestjs/common';
import { IsIn, IsString, Length } from 'class-validator';

class ProbeDto {
  @IsString()
  @Length(3, 20)
  name!: string;

  @IsIn(['A', 'B'])
  kind!: string;
}

/** Test-only controller to exercise the global ValidationPipe. Not part of AppModule. */
@Controller('probe')
export class ProbeController {
  @Post()
  create(@Body() body: ProbeDto): { ok: boolean; name: string } {
    return { ok: true, name: body.name };
  }
}
